import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, GraduationCap } from 'lucide-react';
import { invokeBackend } from '../backend';
import { useStore } from '../store';
import { normalizeSchoolSite, schoolPagePath } from '../schoolWebsiteModel';
import { SchoolSiteCanvas } from './SchoolSiteCanvas';
import { SchoolWebsiteBuilder } from './SchoolWebsiteBuilder';

export function PublicSchool() {
  const { pathname } = useLocation();
  const { data, user, role, authLoading } = useStore();
  const admin = pathname === '/school-admin' || pathname === '/admin/website';
  const saved = useMemo(
    () => normalizeSchoolSite(data.settings.publicSite),
    [data.settings.publicSite],
  );
  const [published, setPublished] = useState<typeof saved>();
  const [starter] = useState(() => normalizeSchoolSite(undefined));
  useEffect(() => {
    if (admin) return;
    let active = true;
    void invokeBackend('school-website', { action: 'public-content' })
      .then((result) => {
        if (active) setPublished(normalizeSchoolSite(result.site));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [admin]);
  if (admin) {
    if (authLoading) return <p role="status">Loading website editor…</p>;
    if (role !== 'Administrator' || !user)
      return (
        <main className="school-admin-gate">
          <div>
            <GraduationCap size={36} />
            <h1>School website editor</h1>
            <p>Sign in with an administrator account to update the public school website.</p>
            <Link className="school-button" to="/">
              Open staff sign in <ArrowRight size={17} />
            </Link>
          </div>
        </main>
      );
    return (
      <SchoolWebsiteBuilder
        key={user.id}
        owner={user.id}
        published={saved}
        source={data.settings.publicSite}
      />
    );
  }
  const site = published || starter;
  const pageKey =
    Object.keys(site.pages).find(
      (key) =>
        schoolPagePath(key) === pathname || (key !== 'home' && pathname === '/school/' + key),
    ) || 'home';
  return <SchoolSiteCanvas site={site} pageKey={pageKey} />;
}
