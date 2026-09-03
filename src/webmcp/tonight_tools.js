import { useStore } from '@/store/use-store';
import { reservationLink } from '@/lib/reservation-link';
import { toast } from 'sonner';

/**
 * "Tonight" — the shared plan a person and their agent build together.
 *
 * The plan lives in the page (zustand store, persisted per browser). The
 * Tonight panel renders it for the person; these tools expose it to the
 * agent. Both act on the same list: the agent adds and orders stops, the
 * person drags, vetoes, and locks. Locked stops are constraints the agent
 * must plan around — mutations against them return a refusal the agent
 * can read, not an exception.
 */

const SITE = 'https://www.312deals.com';

function mcpResponse(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

async function apiFetch(path) {
  const resp = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`API error ${resp.status}: ${resp.statusText}`);
  return resp.json();
}

function todayInChicago() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' }).toLowerCase();
}

function normDays(days) {
  if (Array.isArray(days)) return days.map((d) => String(d).toLowerCase());
  if (typeof days === 'string') {
    try { const parsed = JSON.parse(days); if (Array.isArray(parsed)) return parsed.map((d) => String(d).toLowerCase()); } catch (_) {}
    return days.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  }
  return null;
}

function minutes(t) {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// The booking link carries the plan: the plan's start time (the person's
// stated intent), else the stop's own window start, and the group size — so
// OpenTable/Resy open on the right slot instead of their 7 PM-for-2 default.
function stopReservation(s) {
  const { constraints } = useStore.getState().tonight;
  const link = reservationLink(s, {
    time: constraints.startTime || s.startTime,
    partySize: constraints.groupSize,
  });
  return link
    ? { url: link.url, platform: link.platform, for: `${link.partySize} at ${link.time || 'venue default'} on ${link.date}` }
    : null;
}

function publicStop(s, index) {
  return {
    stop: index + 1,
    stop_id: s.id,
    venue_name: s.venueName,
    neighborhood: s.neighborhood,
    address: s.address,
    deal: s.dealTitle,
    deal_type: s.dealType,
    days: s.daysAvailable,
    window: s.isAllDay ? 'all day' : [s.startTime, s.endTime].filter(Boolean).join('–') || null,
    estimated_savings_per_person: s.estimatedSavings,
    locked_by_user: s.locked,
    added_by: s.addedBy,
    note: s.note,
    url: s.venueSlug ? `${SITE}/venues/${s.venueSlug}` : null,
    reservation: stopReservation(s),
    order_online: s.onlineOrderUrl || null,
  };
}

function planSnapshot() {
  const { tonight } = useStore.getState();
  const stops = tonight.stops.map(publicStop);
  const locked = stops.filter((s) => s.locked_by_user).map((s) => s.stop);
  return {
    stops,
    stop_count: stops.length,
    locked_stops: locked,
    constraints: tonight.constraints,
    last_change_by: tonight.lastChangeBy,
    updated_at: tonight.updatedAt,
    guidance:
      stops.length === 0
        ? 'The plan is empty. Add stops with tonight_add_stop (search first with search_chicago_deals or plan_chicago_deal_crawl).'
        : locked.length
          ? `Stops ${locked.join(', ')} are locked by the user: plan around them. Never unlock a stop yourself, even if asked to remove it — say it is locked and let the person unlock it by hand.`
          : 'The user has not locked anything yet. Check the panel after changes — they may reorder or veto.',
  };
}

function pickDeal(venue, dealId) {
  const deals = Array.isArray(venue.deals) ? venue.deals : [];
  if (dealId != null) return deals.find((d) => Number(d.id) === Number(dealId)) || null;
  if (deals.length === 0) return null;
  const today = todayInChicago();
  const score = (d) => {
    const days = normDays(d.days_available);
    let s = 0;
    if (!days || days.length === 0 || days.includes(today) || days.includes('daily') || days.includes('everyday')) s += 100;
    s += Number(d.estimated_savings_per_person) || 0;
    if (d.is_verified) s += 5;
    return s;
  };
  return [...deals].sort((a, b) => score(b) - score(a))[0];
}

async function resolveVenue({ venue_name, venue_id }) {
  const q = new URLSearchParams();
  if (venue_name) q.set('name', venue_name);
  if (venue_id != null) q.set('id', String(venue_id));
  const data = await apiFetch(`/api/v1/venues/search?${q}`);
  return (data.venues || [])[0] || null;
}

function stopFromVenue(venue, deal, extra) {
  return {
    dealId: deal ? Number(deal.id) : null,
    venueId: venue.id != null ? Number(venue.id) : null,
    venueName: venue.name,
    venueSlug: venue.slug || null,
    neighborhood: venue.neighborhood || deal?.neighborhood || null,
    address: venue.address || null,
    dealTitle: deal?.title || null,
    dealType: deal?.deal_type || null,
    daysAvailable: deal ? normDays(deal.days_available) : null,
    startTime: deal?.start_time || null,
    endTime: deal?.end_time || null,
    isAllDay: !!(deal && deal.is_all_day),
    estimatedSavings: deal?.estimated_savings_per_person != null ? Number(deal.estimated_savings_per_person) : null,
    resyUrl: venue.resy_url || null,
    opentableUrl: venue.opentable_url || null,
    onlineOrderUrl: venue.online_order_url || null,
    addedBy: 'agent',
    note: extra?.note || null,
  };
}

function findStop(stopRef) {
  const { tonight } = useStore.getState();
  if (stopRef == null) return null;
  const byId = tonight.stops.find((s) => s.id === stopRef);
  if (byId) return byId;
  const n = Number(stopRef);
  if (Number.isInteger(n) && n >= 1 && n <= tonight.stops.length) return tonight.stops[n - 1];
  return null;
}

export const TONIGHT_TOOLS = [
  {
    name: 'tonight_get_plan',
    description:
      "Read the user's shared 'Tonight' plan on this page: ordered stops with venue, deal, time window, " +
      'which stops the user has locked (do not move or remove those), and any constraints (budget, hours, ' +
      'group size, neighborhood). Call this before changing the plan, and after the user says they edited it.',
    registrationType: 'imperative',
    readOnly: true,
    inputSchema: { type: 'object', properties: {} },
    execute: async () => mcpResponse(planSnapshot()),
  },
  {
    name: 'tonight_set_constraints',
    description:
      "Set the frame for tonight's plan: budget per person, start/end time, group size, max stops, anchor " +
      'neighborhood. Shown in the Tonight panel so the user can see what the agent is planning against.',
    registrationType: 'imperative',
    readOnly: false,
    annotations: { destructiveHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        budget_per_person: { type: 'number', description: 'Dollars per person for the whole night' },
        start_time: { type: 'string', description: 'e.g. "17:30" or "6pm"' },
        end_time: { type: 'string', description: 'e.g. "22:00" or "10pm"' },
        group_size: { type: 'integer' },
        max_stops: { type: 'integer' },
        neighborhood: { type: 'string', description: 'Anchor neighborhood, e.g. "Wicker Park"' },
      },
    },
    execute: async (p) => {
      useStore.getState().setTonightConstraints(
        {
          ...(p.budget_per_person != null && { budgetPerPerson: Number(p.budget_per_person) }),
          ...(p.start_time && { startTime: String(p.start_time) }),
          ...(p.end_time && { endTime: String(p.end_time) }),
          ...(p.group_size != null && { groupSize: Number(p.group_size) }),
          ...(p.max_stops != null && { maxStops: Number(p.max_stops) }),
          ...(p.neighborhood && { neighborhood: String(p.neighborhood) }),
        },
        'agent',
      );
      toast('Your agent set the plan for tonight', { description: 'See the Tonight panel.' });
      return mcpResponse({ ok: true, ...planSnapshot() });
    },
  },
  {
    name: 'tonight_add_stop',
    description:
      "Add a venue to the user's Tonight plan (appears immediately in the Tonight panel, marked 'added by agent'). " +
      'Give venue_name (as returned by search_chicago_deals or plan_chicago_deal_crawl) and optionally the deal_id ' +
      'to pin a specific deal; otherwise the best deal for today is chosen. position is 1-based; omit to append. ' +
      'Respect constraints and locked stops from tonight_get_plan.',
    registrationType: 'imperative',
    readOnly: false,
    annotations: { destructiveHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        venue_name: { type: 'string', description: 'Venue name, e.g. "Big Star"' },
        venue_id: { type: 'integer', description: 'Venue id (alternative to venue_name)' },
        deal_id: { type: 'integer', description: 'Pin a specific deal id at this venue' },
        position: { type: 'integer', description: '1-based slot in the plan; omit to append' },
        note: { type: 'string', description: 'Short reason shown to the user, e.g. "$1 oysters until 6"' },
      },
    },
    execute: async (p) => {
      if (!p.venue_name && p.venue_id == null) return mcpResponse({ error: 'Provide venue_name or venue_id.' });
      const store = useStore.getState();
      const { constraints, stops } = store.tonight;
      if (constraints.maxStops && stops.length >= constraints.maxStops) {
        return mcpResponse({ error: `The plan already has ${stops.length} stops and max_stops is ${constraints.maxStops}. Remove an unlocked stop or raise max_stops.`, ...planSnapshot() });
      }
      const venue = await resolveVenue(p);
      if (!venue) return mcpResponse({ error: `No venue matched "${p.venue_name || p.venue_id}". Search first with search_chicago_deals.` });
      const deal = pickDeal(venue, p.deal_id);
      if (p.deal_id != null && !deal) return mcpResponse({ error: `Deal ${p.deal_id} is not at ${venue.name}.` });
      const stop = store.addTonightStop(stopFromVenue(venue, deal, p), p.position != null ? Number(p.position) - 1 : undefined);
      toast(`Your agent added ${venue.name}`, { description: deal?.title || 'to tonight’s plan' });
      return mcpResponse({ ok: true, added: publicStop(stop, useStore.getState().tonight.stops.findIndex((s) => s.id === stop.id)), ...planSnapshot() });
    },
  },
  {
    name: 'tonight_remove_stop',
    description:
      "Remove a stop from the user's Tonight plan by stop_id or 1-based stop number. Refuses if the user locked it — " +
      'never unlock a stop yourself to get around that; report that it is locked and stop.',
    registrationType: 'imperative',
    readOnly: false,
    annotations: { destructiveHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: { stop: { type: 'string', description: 'stop_id from tonight_get_plan, or the stop number' } },
      required: ['stop'],
    },
    execute: async (p) => {
      const stop = findStop(p.stop);
      if (!stop) return mcpResponse({ error: 'No such stop.', ...planSnapshot() });
      const res = useStore.getState().removeTonightStop(stop.id);
      if (res.ok) toast(`Your agent removed ${stop.venueName}`);
      return mcpResponse({ ...res, ...planSnapshot() });
    },
  },
  {
    name: 'tonight_move_stop',
    description:
      'Move a stop to a new 1-based position in the Tonight plan. Locked stops cannot be moved or displaced.',
    registrationType: 'imperative',
    readOnly: false,
    annotations: { destructiveHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        stop: { type: 'string', description: 'stop_id or stop number' },
        position: { type: 'integer', description: 'New 1-based position' },
      },
      required: ['stop', 'position'],
    },
    execute: async (p) => {
      const stop = findStop(p.stop);
      if (!stop) return mcpResponse({ error: 'No such stop.', ...planSnapshot() });
      const res = useStore.getState().moveTonightStop(stop.id, Number(p.position) - 1);
      if (res.ok) toast(`Your agent moved ${stop.venueName} to stop ${p.position}`);
      return mcpResponse({ ...res, ...planSnapshot() });
    },
  },
  {
    name: 'tonight_order_by_deal_window',
    description:
      "Reorder the unlocked stops so each deal's time window is visited in order (earliest-ending happy hours first, " +
      'all-day deals last). Locked stops keep their slots. Returns the new order and why.',
    registrationType: 'imperative',
    readOnly: false,
    annotations: { destructiveHint: false, openWorldHint: false, idempotentHint: true },
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const { tonight } = useStore.getState();
      const unlocked = tonight.stops.filter((s) => !s.locked);
      const key = (s) => (s.isAllDay || !s.endTime ? 24 * 60 + (minutes(s.startTime) ?? 0) : minutes(s.endTime) ?? 24 * 60);
      const ordered = [...unlocked].sort((a, b) => key(a) - key(b));
      const res = useStore.getState().reorderTonightUnlocked(ordered.map((s) => s.id), 'agent');
      if (res.ok && unlocked.length > 1) toast('Your agent reordered the plan by deal windows');
      return mcpResponse({
        ...res,
        reasoning: ordered.map((s) => `${s.venueName}: ${s.isAllDay ? 'all day' : `${s.startTime || '?'}–${s.endTime || '?'}`}`),
        ...planSnapshot(),
      });
    },
  },
  {
    name: 'tonight_clear',
    description: "Clear the user's Tonight plan. Keeps locked stops unless keep_locked is false.",
    registrationType: 'imperative',
    readOnly: false,
    annotations: { destructiveHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: { keep_locked: { type: 'boolean', default: true } },
    },
    execute: async (p) => {
      const removed = useStore.getState().clearTonight({ keepLocked: p.keep_locked !== false, by: 'agent' });
      if (removed) toast(`Your agent cleared ${removed} stop${removed === 1 ? '' : 's'}`);
      return mcpResponse({ ok: true, removed, ...planSnapshot() });
    },
  },
];

export default TONIGHT_TOOLS;
