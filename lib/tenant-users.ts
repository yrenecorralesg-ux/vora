import type { TenantMembership } from '@/lib/types';

export interface TenantInvitationSummary {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
}

export interface TenantUserDisplay {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  role: string;
  status: string;
  created_at: string;
  kind: 'membership' | 'invitation';
}

/** Only look up identities already linked to this tenant. The caller must authorize access. */
export async function resolveTenantUsers(
  memberships: TenantMembership[],
  invitations: TenantInvitationSummary[],
  lookupEmail: (userId: string) => Promise<string | null>,
  now = Date.now(),
): Promise<TenantUserDisplay[]> {
  const users = await Promise.all(
    memberships.map(async (member): Promise<TenantUserDisplay> => {
      let email: string | null = null;
      try {
        email = await lookupEmail(member.auth_user_id);
      } catch {
        // Keep the membership visible if Auth is temporarily unavailable.
      }
      return {
        id: member.id,
        auth_user_id: member.auth_user_id,
        email,
        role: member.role,
        status: member.status,
        created_at: member.created_at,
        kind: 'membership',
      };
    }),
  );
  const activeEmails = new Set(
    users
      .filter((u) => u.status === 'active' && u.email)
      .map((u) => u.email!.trim().toLowerCase()),
  );
  const queued: TenantUserDisplay[] = invitations
    .filter(
      (invite) =>
        ['pending', 'expired'].includes(invite.status) &&
        !activeEmails.has(invite.email.trim().toLowerCase()),
    )
    .map((invite) => ({
      id: `invitation-${invite.id}`,
      auth_user_id: null,
      email: invite.email,
      role: invite.role,
      status:
        invite.status === 'pending' && Date.parse(invite.expires_at) <= now
          ? 'expired'
          : invite.status,
      created_at: invite.created_at,
      kind: 'invitation',
    }));
  return [...users, ...queued];
}
