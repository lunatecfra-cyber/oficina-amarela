import { EmailExplorer } from "email-explorer";

export { MailboxDO } from "email-explorer";

// Smart Mode:
// - The first user to register automatically becomes the admin/owner.
// - Registration closes after the first user.
// - Admins can create additional users and manage mailboxes.
const app = EmailExplorer({
  auth: {
    enabled: true,
  },
});

export default {
  async email(event: any, env: any, context: any) {
    return app.email(event, env, context);
  },
  async fetch(request: Request, env: any, context: any) {
    const url = new URL(request.url);

    // Enrich GET /api/v1/auth/admin/users with each user's assigned mailboxes
    if (request.method === "GET" && url.pathname === "/api/v1/auth/admin/users") {
      const response = await app.fetch(request, env, context);
      if (response.status === 200) {
        try {
          const users = (await response.clone().json()) as any[];
          if (Array.isArray(users)) {
            const authId = env.MAILBOX.idFromName("AUTH");
            const authDO = env.MAILBOX.get(authId);

            const enrichedUsers = await Promise.all(
              users.map(async (u) => {
                try {
                  const mailboxes = await authDO.getUserMailboxes(u.id);
                  return {
                    ...u,
                    mailboxes: mailboxes ?? [],
                  };
                } catch {
                  return {
                    ...u,
                    mailboxes: [],
                  };
                }
              })
            );

            return new Response(JSON.stringify(enrichedUsers), {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            });
          }
        } catch {
          // fallback to original response
        }
      }
      return response;
    }

    return app.fetch(request, env, context);
  },
};
