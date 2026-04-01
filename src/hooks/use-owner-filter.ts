import { useViewAs } from "@/hooks/use-view-as";

/**
 * Returns the owner_id filter for data queries.
 * When admin is viewing as another user, returns that user's ID.
 * Otherwise returns null (no extra filter — RLS handles it).
 */
export function useOwnerFilter() {
  const { viewAsUserId, isViewingAs } = useViewAs();
  return { ownerFilter: isViewingAs ? viewAsUserId : null, isViewingAs };
}
