import { getAISlotRecommendation } from '../utils/aiRecommendation';
import { ProcurementCentre, SlotBooking, FarmerProfile } from '../types';

// ---------------------------------------------------------------------------
// Context object the orchestrator hands to every tool call.
// Built fresh each turn from live React state (centres, bookings, farmer),
// plus the two mutating functions pulled straight from KisanFlowContext.
// ---------------------------------------------------------------------------
export interface AgentToolContext {
  farmer: FarmerProfile;
  centres: ProcurementCentre[];
  bookings: SlotBooking[];
  bookNewSlot: (data: {
    centreId: string;
    cropType: string;
    variety: string;
    estimatedQuantity: number;
    bookingDate: string;
    slotTime: string;
    tokenNumber?: string;
    skipDbInsert?: boolean;
  }) => SlotBooking;
}

// In-memory draft store. Keyed by draftId. Cleared on page reload — fine,
// since a draft that outlives a session should be re-proposed anyway.
const pendingDrafts: Record<string, BookingDraft> = {};

export interface BookingDraft {
  draftId: string;
  centreId: string;
  centreName: string;
  cropType: string;
  variety: string;
  quantity: number;
  date: string;
  time: string;
  status: 'PENDING_USER_CONFIRMATION';
}

// ---------------------------------------------------------------------------
// Informational tools — safe, no side effects
// ---------------------------------------------------------------------------

export function listCentres(ctx: AgentToolContext) {
  return ctx.centres.map(c => ({
    id: c.id,
    name: c.name,
    distanceKm: c.distanceKm,
    currentQueue: c.currentQueue,
    waitTimeMin: c.waitTimeMin,
    congestion: c.congestion,
    activeCounters: c.activeCounters,
    totalCounters: c.totalCounters,
    isOpen: c.isOpen,
  }));
}

export function getMyBookings(ctx: AgentToolContext) {
  return ctx.bookings
    .filter(b => b.farmerId === ctx.farmer.id)
    .map(b => ({
      tokenNumber: b.tokenNumber,
      centreName: b.centreName,
      cropType: b.cropType,
      estimatedQuantity: b.estimatedQuantity,
      bookingDate: b.bookingDate,
      slotTime: b.slotTime,
      status: b.status,
      totalAmount: b.totalAmount,
    }));
}

export async function recommendCentre(
  ctx: AgentToolContext,
  args: { cropType: string; quantity: number }
) {
  const rec = await getAISlotRecommendation({
    farmer: ctx.farmer,
    centres: ctx.centres,
    cropType: args.cropType,
    quantity: args.quantity,
  });
  if (!rec) return { error: 'Recommendation service unavailable.' };
  const centre = ctx.centres.find(c => c.id === rec.recommendedCentreId);
  return { ...rec, centreName: centre?.name ?? rec.recommendedCentreId };
}

const RAG_ENDPOINT = import.meta.env.VITE_RAG_ENDPOINT || ''; // e.g. https://your-rag-service.onrender.com/rag

export async function ragQuery(args: { question: string }) {
  if (!RAG_ENDPOINT) {
    return { error: 'Knowledge base is not configured yet.' };
  }
  try {
    const res = await fetch(RAG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: args.question, top_k: 4 }),
    });
    if (!res.ok) throw new Error(`RAG endpoint returned ${res.status}`);
    const data = await res.json();
    if (!data.answer_context) {
      return { context: '', note: 'No relevant information found in the knowledge base.' };
    }
    return { context: data.answer_context, sources: data.sources };
  } catch (err: any) {
    return { error: `Could not reach knowledge base: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// Mutating tools — split into draft (safe) and confirm (writes data)
// ---------------------------------------------------------------------------

export function proposeBooking(
  ctx: AgentToolContext,
  args: {
    centreId: string;
    cropType: string;
    variety: string;
    quantity: number;
    date: string;
    time: string;
  }
): BookingDraft | { error: string } {
  const centre = ctx.centres.find(c => c.id === args.centreId);
  if (!centre) return { error: `No centre found with id ${args.centreId}` };

  const draftId = `draft-${Date.now()}`;
  const draft: BookingDraft = {
    draftId,
    centreId: args.centreId,
    centreName: centre.name,
    cropType: args.cropType,
    variety: args.variety,
    quantity: args.quantity,
    date: args.date,
    time: args.time,
    status: 'PENDING_USER_CONFIRMATION',
  };

  pendingDrafts[draftId] = draft;
  return draft;
}

export function confirmBooking(
  ctx: AgentToolContext,
  args: { draftId: string }
): SlotBooking | { error: string } {
  const draft = pendingDrafts[args.draftId];
  if (!draft) {
    return { error: 'That draft no longer exists. Please propose a new booking.' };
  }

  const booking = ctx.bookNewSlot({
    centreId: draft.centreId,
    cropType: draft.cropType,
    variety: draft.variety,
    estimatedQuantity: draft.quantity,
    bookingDate: draft.date,
    slotTime: draft.time,
  });

  delete pendingDrafts[args.draftId];
  return booking;
}

// ---------------------------------------------------------------------------
// Dispatcher — orchestrator calls this with a tool name + raw args
// ---------------------------------------------------------------------------

export async function executeTool(
  name: string,
  args: any,
  ctx: AgentToolContext
): Promise<any> {
  switch (name) {
    case 'list_centres':
      return listCentres(ctx);
    case 'get_my_bookings':
      return getMyBookings(ctx);
    case 'recommend_centre':
      return recommendCentre(ctx, args);
    case 'rag_query':
      return ragQuery(args);
    case 'propose_booking':
      return proposeBooking(ctx, args);
    case 'confirm_booking':
      return confirmBooking(ctx, args);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}