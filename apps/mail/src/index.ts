import { EmailExplorer } from "email-explorer";

export { MailboxDO } from "email-explorer";

// Smart Mode:
// - The first user to register automatically becomes the admin/owner.
// - Registration closes after the first user.
// - Admins can create additional users and manage mailboxes.
export default EmailExplorer({
  auth: {
    enabled: true,
  },
});
