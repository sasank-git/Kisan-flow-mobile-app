#
# KisanFlow Voice Agent — Pipecat bot
#
# Cascade pipeline: Speech-to-Text -> RAG injection -> Gemini LLM (+ tools) -> Text-to-Speech
#
# Tool set mirrors the text-chat agent (src/agent/tools.ts):
#   list_centres, get_my_bookings, recommend_centre, propose_booking, confirm_booking
# RAG is NOT a tool here — RAGProcessor auto-injects retrieved context into
# the LLM's system context before every turn, so Gemini just answers
# naturally using whatever was injected.
#
# Run:
#     uv run bot.py
#

import os
import random
import time

from dotenv import load_dotenv
from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.services.cartesia.tts import CartesiaTTSService
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.workers.runner import WorkerRunner
from pipecat.services.google.llm import GoogleLLMService

from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.services.llm_service import FunctionCallParams

from supabase import create_client, Client
from pipecat.processors.frameworks.rtvi import RTVIServerMessageFrame


load_dotenv(override=True)

from rag_processor import RAGProcessor

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VECTOR_DB_PATH = os.path.join(BASE_DIR, "vector_db")

supabase: Client = create_client(
    os.getenv("SUPABASE_URL", ""),
    os.getenv("SUPABASE_KEY", ""),
)


# In-memory draft store, same pattern as tools.ts's pendingDrafts.
# Keyed by draftId. Cleared naturally per-session (module reload/restart).
_pending_drafts: dict = {}


def get_msp(crop_type: str) -> int:
    c = (crop_type or "").lower()
    if "wheat" in c:
        return 2275
    if "cotton" in c:
        return 6620
    if "soya" in c or "soybean" in c:
        return 4600
    if "mustard" in c:
        return 5650
    if "maize" in c:
        return 2090
    return 2183


# ---------------------------------------------------------------------------
# Tool handlers — mirror tools.ts exactly (list_centres, get_my_bookings,
# recommend_centre, propose_booking, confirm_booking)
# ---------------------------------------------------------------------------

async def list_centres_tool(params: FunctionCallParams):
    try:
        res = supabase.table("centres").select("*").execute()
        centres = res.data or []
        summary = [
            {
                "id": c.get("id"),
                "name": c.get("name"),
                "distanceKm": c.get("distance_km"),
                "currentQueue": c.get("current_queue"),
                "waitTimeMin": c.get("wait_time_min"),
                "congestion": c.get("congestion"),
                "isOpen": c.get("is_open"),
            }
            for c in centres
        ]
        await params.result_callback({"centres": summary})
    except Exception as e:
        logger.error(f"list_centres failed: {e}")
        await params.result_callback({"error": "Could not fetch centre data right now."})


async def get_my_bookings_tool(params: FunctionCallParams, farmer_id: str):
    try:
        res = (
            supabase.table("tokens")
            .select("*")
            .eq("farmer_id", farmer_id)
            .in_("status", ["BOOKED", "CHECKED_IN", "PROCESSING"])
            .execute()
        )
        await params.result_callback({"bookings": res.data or []})
    except Exception as e:
        logger.error(f"get_my_bookings failed: {e}")
        await params.result_callback({"error": "Could not fetch your bookings right now."})


async def recommend_centre_tool(params: FunctionCallParams):
    # Simplified heuristic version (no Gemini-inside-Gemini call here —
    # keep the voice loop fast). Picks lowest wait time, same fallback
    # logic as aiRecommendation.ts's getFallbackRecommendation.
    args = params.arguments
    try:
        res = supabase.table("centres").select("*").execute()
        centres = res.data or []
        if not centres:
            await params.result_callback({"error": "No centre data available."})
            return
        best = min(centres, key=lambda c: c.get("wait_time_min", 9999))
        await params.result_callback({
            "recommendedCentreId": best.get("id"),
            "centreName": best.get("name"),
            "expectedWaitMin": best.get("wait_time_min"),
            "reasoning": f"{best.get('name')} currently has the lowest queue and wait time.",
        })
    except Exception as e:
        logger.error(f"recommend_centre failed: {e}")
        await params.result_callback({"error": "Could not get a recommendation right now."})


from pipecat.processors.frameworks.rtvi import RTVIServerMessageFrame
# ^ if this import path 404s on your installed version, run:
#   python -c "import pipecat.processors.frameworks.rtvi as m; print([x for x in dir(m) if 'Server' in x])"
# and swap the path — the class name is stable across recent versions, the module path sometimes isn't.

_rtvi_ref = {"rtvi": None}  # filled in once the worker exists

async def propose_booking_tool(params: FunctionCallParams):
    args = params.arguments
    draft_id = f"draft-{int(time.time() * 1000)}"
    draft = {
        "draftId": draft_id,
        "centreId": args.get("centreId"),
        "centreName": args.get("centreName", args.get("centreId")),
        "cropType": args.get("cropType"),
        "variety": args.get("variety", ""),
        "quantity": args.get("quantity"),
        "date": args.get("date"),
        "time": args.get("time"),
    }
    _pending_drafts[draft_id] = draft

    # NEW: push the draft to the frontend as a data-channel message so the
    # UI can render the BookingDraftCard immediately, same shape as text chat.
    if _rtvi_ref["rtvi"] is not None:
        await _rtvi_ref["rtvi"].push_frame(
            RTVIServerMessageFrame(data={"type": "booking_draft", "draft": draft})
        )

    await params.result_callback({
        "draftId": draft_id,
        "status": "PENDING_USER_CONFIRMATION",
        **draft,
    })


async def confirm_booking_tool(params: FunctionCallParams, farmer: dict):
    draft_id = params.arguments.get("draftId")
    draft = _pending_drafts.get(draft_id)
    if not draft:
        await params.result_callback({"error": "I don't have that draft anymore. Let's create a new one."})
        return

    token_number = f"KF-{random.randint(10000, 99999)}"
    quantity = draft.get("quantity") or 0
    msp = get_msp(draft.get("cropType", ""))
    total_amount = quantity * msp

    try:
        supabase.table("tokens").insert({
            "token_number": token_number,
            "centre_id": draft.get("centreId"),
            "farmer_id": farmer.get("id", "voice-guest"),
            "farmer_name": farmer.get("name", "Voice Farmer"),
            "mobile": farmer.get("mobile", ""),
            "village": farmer.get("village", ""),
            "crop_type": draft.get("cropType"),
            "variety": draft.get("variety"),
            "slot_date": draft.get("date"),
            "slot_time": draft.get("time"),
            "estimated_quantity": quantity,
            "total_amount": total_amount,
            "status": "BOOKED",
        }).execute()

        del _pending_drafts[draft_id]
        await params.result_callback({
            "tokenNumber": token_number,
            "status": "BOOKED",
            "message": f"Booked! Your token number is {token_number}.",
        })
    except Exception as e:
        logger.error(f"confirm_booking failed: {e}")
        await params.result_callback({"error": "The booking system is busy. Please try again."})


# ---------------------------------------------------------------------------

async def run_bot(transport: BaseTransport, runner_args: RunnerArguments) -> None:
    logger.info("Starting KisanFlow voice bot")

    # Farmer identity passed in via the client's session request body,
    # e.g. { "farmer_id": "KF-R810241", "farmer_name": "Ramesh Kumar", ... }.
    # Falls back to a generic guest identity if missing so the bot never
    # crashes, but bookings made this way won't be tied to a real account.
    body = getattr(runner_args, "body", None) or {}
    farmer = {
        "id": body.get("farmer_id", "voice-guest"),
        "name": body.get("farmer_name", ""),
        "mobile": body.get("farmer_mobile", ""),
        "village": body.get("farmer_village", ""),
    }
    greeting_name = farmer["name"].split(" ")[0] if farmer["name"] else "there"

    stt = DeepgramSTTService(api_key=os.getenv("DEEPGRAM_API_KEY"))

    tts = CartesiaTTSService(
        api_key=os.getenv("CARTESIA_API_KEY"),
        settings=CartesiaTTSService.Settings(
            voice=os.getenv("CARTESIA_VOICE_ID", "71a7ad14-091c-4e8e-a314-022ece01c121"),
        ),
    )

    list_centres_fn = FunctionSchema(
        name="list_centres",
        description="Get live status of all nearby mandi centres — queue, wait time, congestion, open/closed.",
        properties={},
        required=[],
    )
    get_my_bookings_fn = FunctionSchema(
        name="get_my_bookings",
        description="Get the farmer's existing active slot bookings.",
        properties={},
        required=[],
    )
    recommend_centre_fn = FunctionSchema(
        name="recommend_centre",
        description="Get the best recommended centre for a crop type and quantity, based on live wait times.",
        properties={
            "cropType": {"type": "string"},
            "quantity": {"type": "number", "description": "in quintals"},
        },
        required=["cropType", "quantity"],
    )
    propose_booking_fn = FunctionSchema(
        name="propose_booking",
        description=(
            "Create a DRAFT booking for the user to review out loud. Does NOT book anything. "
            "Always call this before confirm_booking, and always read the details back to the "
            "user before asking them to confirm."
        ),
        properties={
            "centreId": {"type": "string"},
            "centreName": {"type": "string"},
            "cropType": {"type": "string"},
            "variety": {"type": "string"},
            "quantity": {"type": "number"},
            "date": {"type": "string", "description": "'Today', 'Tomorrow', or a date"},
            "time": {"type": "string", "description": "e.g. '11:30 AM'"},
        },
        required=["centreId", "cropType", "quantity", "date", "time"],
    )
    confirm_booking_fn = FunctionSchema(
        name="confirm_booking",
        description=(
            "Finalize and actually book a slot. ONLY call this after the user has clearly "
            "said yes/confirm to THAT SPECIFIC draft out loud. Never call this in the same "
            "turn as propose_booking, and never call it speculatively."
        ),
        properties={"draftId": {"type": "string"}},
        required=["draftId"],
    )

    tools = ToolsSchema(standard_tools=[
        list_centres_fn, get_my_bookings_fn, recommend_centre_fn,
        propose_booking_fn, # confirm_booking_fn,
    ])

    llm = GoogleLLMService(
        api_key=os.getenv("VITE_GOOGLE_GENAI_API_KEY") or os.getenv("GOOGLE_API_KEY"),
        model="gemini-3.5-flash-lite",
    )

    llm.register_function("list_centres", list_centres_tool)
    llm.register_function("get_my_bookings", lambda p: get_my_bookings_tool(p, farmer["id"]))
    llm.register_function("recommend_centre", recommend_centre_tool)
    llm.register_function("propose_booking", propose_booking_tool)
    # llm.register_function("confirm_booking", lambda p: confirm_booking_tool(p, farmer))

    messages = [
        {
            "role": "system",
            "content": (
                "You are KisanFlow's voice assistant, helping a farmer with grain procurement "
                "at mandi centres. You can check centre wait times, recommend the best centre, "
                "and propose slot bookings. For booking: gather crop type and quantity, call "
                "recommend_centre, then propose_booking, then read the details back clearly and "
                "tell the user to tap the Confirm Booking button shown on their screen to finalize "
                "it. You cannot book a slot yourself — only the on-screen button can confirm it, "
                "even if the user says yes out loud. Keep responses short and conversational since "
                "this is spoken aloud, not read. Use any additional context you're given about "
                "mandi rules, MSP rates, or grading policy to answer general questions naturally."
            ),
        },
    ]

    context = LLMContext(messages, tools=tools)
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer()),
    )

    rag = RAGProcessor(context=context, db_path=VECTOR_DB_PATH, top_k=2)

    pipeline = Pipeline([
        transport.input(),
        stt,
        rag,
        user_aggregator,
        llm,
        tts,
        transport.output(),
        assistant_aggregator,
    ])

    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(enable_metrics=True, enable_usage_metrics=True),
        observers=[],
    )

    _rtvi_ref["rtvi"] = worker.rtvi   # NEW — lets propose_booking_tool push messages

    @worker.rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi):
        context.add_message({
            "role": "developer",
            "content": f"Greet {greeting_name} briefly and ask how you can help with their mandi slot today.",
        })
        await worker.queue_frames([LLMRunFrame()])

    @worker.rtvi.event_handler("on_client_message")
    async def on_client_message(rtvi, message):
        logger.info(f"RAW client message received: {message!r}")  # ADD — tells us the real shape

        # RTVI client messages are sometimes delivered as an object with
        # .type / .data attributes instead of a plain dict, and the payload
        # is sometimes nested under "data" rather than flat. Handle both so
        # we don't silently fail on a shape mismatch.
        msg_type = None
        payload = message

        if isinstance(message, dict):
            msg_type = message.get("type")
            payload = message.get("data", message)
        else:
            msg_type = getattr(message, "type", None)
            payload = getattr(message, "data", message)

        if isinstance(payload, str):
            import json
            try:
                payload = json.loads(payload)
            except Exception:
                pass

        logger.info(f"Parsed msg_type={msg_type!r} payload={payload!r}")  # ADD

        if msg_type == "confirm_booking_tap":
            draft_id = payload.get("draftId") if isinstance(payload, dict) else None
            logger.info(f"Attempting confirm for draft_id={draft_id!r}, pending drafts: {list(_pending_drafts.keys())}")  # ADD
            class _FakeParams:
                arguments = {"draftId": draft_id}
                async def result_callback(self, result):
                    await worker.rtvi.push_frame(
                        RTVIServerMessageFrame(data={"type": "booking_result", **result})
                    )
            await confirm_booking_tool(_FakeParams(), farmer)

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info(f"Client connected — farmer: {farmer['id']}")

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Client disconnected")
        await worker.cancel()

    runner = WorkerRunner(handle_sigint=False)
    await runner.add_workers(worker)
    await runner.run()


async def bot(runner_args: RunnerArguments):
    transport_params = {
        "webrtc": lambda: TransportParams(audio_in_enabled=True, audio_out_enabled=True),
    }
    transport = await create_transport(runner_args, transport_params)
    await run_bot(transport, runner_args)


if __name__ == "__main__":
    from pipecat.runner.run import main
    main()