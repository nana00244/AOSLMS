import type { Resource, Role, State } from '../data';

export interface ResourceFilters {
  resources: Resource[];
  role: Role | null;
  userId: string;
  activeTab: 'all' | 'my_uploads';
  selectedClassFilter: string;
  selectedCategory: string;
  selectedFileType: string;
  selectedSubject: string;
  searchQuery: string;
  assignedClasses: string[];
  adminUserIds: string[];
}

const targetsFor = (resource: Resource) => resource.targetClassIds || [resource.classId];
const isLegacySeedAdminResource = (resource: Resource) => /^r[0-5]$/.test(resource.id);

export function canManageResource(resource: Resource, userId: string, role: Role | null) {
  return role === 'Administrator' || Boolean(userId && resource.uploadedBy === userId);
}

/** Apply teacher isolation, official class targeting, and the library's normal filters. */
export function filterResources({
  resources,
  role,
  userId,
  activeTab,
  selectedClassFilter,
  selectedCategory,
  selectedFileType,
  selectedSubject,
  searchQuery,
  assignedClasses,
  adminUserIds,
}: ResourceFilters) {
  const assignedClassSet = new Set(assignedClasses);
  const q = searchQuery.trim().toLowerCase();
  return resources.filter((resource) => {
    const targets = targetsFor(resource);
    const own = resource.uploadedBy === userId;
    const adminUploaded =
      resource.uploadedByRole === 'Administrator' ||
      resource.uploadedByRole === 'admin' ||
      adminUserIds.includes(resource.uploadedBy || '') ||
      isLegacySeedAdminResource(resource);

    if (role === 'Teacher') {
      if (activeTab === 'my_uploads') {
        if (!own) return false;
      } else {
        const targetedToMyClass = targets.some(
          (classId) => classId === 'all' || assignedClassSet.has(classId),
        );
        if (!own && !(adminUploaded && targetedToMyClass)) return false;
      }
      if (
        selectedClassFilter !== 'all' &&
        (!assignedClassSet.has(selectedClassFilter) ||
          (!targets.includes(selectedClassFilter) && !targets.includes('all')))
      ) {
        return false;
      }
    } else if (role === 'Student') {
      if (!targets.some((classId) => classId === 'all' || assignedClassSet.has(classId)))
        return false;
    }

    if (
      q &&
      ![resource.title, resource.description, resource.subject]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q))
    ) {
      return false;
    }
    if (selectedCategory !== 'all' && resource.category !== selectedCategory) return false;
    if (
      selectedFileType !== 'all' &&
      (resource.fileType || resource.type).toLowerCase() !== selectedFileType.toLowerCase()
    ) {
      return false;
    }
    if (selectedSubject !== 'all' && (resource.subjectId || resource.subject) !== selectedSubject) {
      return false;
    }
    return true;
  });
}

export function adminUserIds(state: State) {
  return state.users.filter((user) => user.role === 'Administrator').map((user) => user.id);
}
