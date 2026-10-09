import { useEffect, useState, type ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store';
import { teacherService } from '../services/teacherService';

export function TeacherClassGuard({ children }: { children: ReactNode }) {
  const { classId } = useParams<{ classId: string }>();
  const { data, role, user } = useStore();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const verify = async () => {
      if (!user) {
        if (active) setAuthorized(false);
        return;
      }
      if (role === 'Administrator') {
        if (active) setAuthorized(true);
        return;
      }
      if (role !== 'Teacher' || !classId) {
        if (active) setAuthorized(false);
        return;
      }
      const assignments = await teacherService.getAssignedClasses(data, user.id);
      if (active) setAuthorized(assignments.some((assignment) => assignment.classId === classId));
    };
    void verify();
    return () => {
      active = false;
    };
  }, [classId, data, role, user]);

  if (authorized === null) return <div className="page-loading">Checking classroom access…</div>;
  if (!authorized) {
    return (
      <div className="access-restricted">
        <ShieldAlert size={42} />
        <h2>Access restricted</h2>
        <p>
          You are not assigned to this classroom. Only assigned teachers and administrators can
          access it.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/community')}>
          Return to my classrooms
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
