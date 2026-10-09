import { useParams } from 'react-router-dom';
import { BookOpen, Users } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Card, PageHeader, Person, Empty } from '../components/ui';
import { filterResources, adminUserIds } from '../services/resourceService';

export function ClassroomDetail() {
  const { classId = '' } = useParams<{ classId: string }>();
  const { data, role, user, allowedClasses } = useStore();
  const students = data.students.filter((student) => student.classId === classId);
  const assignments = data.assignments.filter((assignment) => assignment.classId === classId);
  const resources = filterResources({
    resources: data.resources,
    role,
    userId: user?.id || '',
    activeTab: 'all',
    selectedClassFilter: role === 'Teacher' ? classId : 'all',
    selectedCategory: 'all',
    selectedFileType: 'all',
    selectedSubject: 'all',
    searchQuery: '',
    assignedClasses: allowedClasses,
    adminUserIds: adminUserIds(data),
  });
  return (
    <>
      <PageHeader
        eyebrow="ASSIGNED CLASSROOM"
        title={classId}
        description="Learners and learning materials for this assigned classroom."
      />
      <div className="class-detail-stats">
        <Card>
          <Users size={20} />
          <strong>{students.length}</strong>
          <span>Students</span>
        </Card>
        <Card>
          <BookOpen size={20} />
          <strong>{assignments.length}</strong>
          <span>Coursework cards</span>
        </Card>
        <Card>
          <BookOpen size={20} />
          <strong>{resources.length}</strong>
          <span>Resources</span>
        </Card>
      </div>
      <section className="section-block">
        <h2>Students</h2>
        <Card>
          {students.length ? (
            students.map((student) => (
              <div className="class-detail-row" key={student.id}>
                <Person name={student.name} sub={student.id} />
                <Badge tone={student.status === 'Active' ? 'green' : 'blue'}>
                  {student.status}
                </Badge>
              </div>
            ))
          ) : (
            <Empty title="No students enrolled" />
          )}
        </Card>
      </section>
      <section className="section-block">
        <h2>Coursework</h2>
        <Card>
          {assignments.length ? (
            assignments.map((assignment) => (
              <div className="class-detail-row" key={assignment.id}>
                <div>
                  <strong>{assignment.title}</strong>
                  <small>{assignment.subject}</small>
                </div>
                <Badge tone="blue">{assignment.category}</Badge>
              </div>
            ))
          ) : (
            <Empty title="No coursework yet" />
          )}
        </Card>
      </section>
    </>
  );
}
