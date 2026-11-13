import { requireAdminPage } from '@src/lib/server/adminAuth';
import { fetchAuditPage, parseAuditPageQuery } from '@src/lib/server/auditFeed';

export async function load({ locals, url }) {
  await requireAdminPage(locals, 'platform:view_audit_log');

  const query = parseAuditPageQuery(url);
  const page = await fetchAuditPage(query);

  return { ...page, source: query.source };
}
