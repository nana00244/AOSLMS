import type { DigitalCertificate } from '../data';

export const certificateService = {
  getAllCertificates: async (certificates: DigitalCertificate[]) => certificates,

  /** Strict student isolation: certificates are returned only for this roster profile. */
  getCertificatesForStudent: async (
    certificates: DigitalCertificate[],
    studentId: string,
  ): Promise<DigitalCertificate[]> =>
    certificates.filter((certificate) => certificate.studentId === studentId),

  /** Return certificates attributed to this teacher only; legacy records use issuedBy as fallback. */
  getCertificatesForTeacher: async (
    certificates: DigitalCertificate[],
    teacherUserId: string,
    teacherId?: string,
    teacherName?: string,
  ): Promise<DigitalCertificate[]> => {
    const cleanUserId = teacherUserId?.trim().toLowerCase();
    const cleanTeacherId = teacherId?.trim().toLowerCase();
    const cleanName = teacherName?.trim().toLowerCase();
    return certificates.filter((certificate) => {
      const creator = (
        certificate.teacherUserId ||
        certificate.issuedByUserId ||
        certificate.createdById
      )
        ?.trim()
        .toLowerCase();
      if (creator) return creator === cleanUserId;
      const profileId = certificate.teacherId?.trim().toLowerCase();
      if (profileId && cleanTeacherId) return profileId === cleanTeacherId;
      return Boolean(cleanName && certificate.issuedBy?.toLowerCase().includes(cleanName));
    });
  },

  createCertificate: (
    data: Omit<
      DigitalCertificate,
      'id' | 'teacherUserId' | 'issuedByUserId' | 'createdById' | 'issuedBy'
    >,
    userId: string,
    userName: string,
  ): DigitalCertificate => ({
    ...data,
    id: `cert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    teacherUserId: userId,
    issuedByUserId: userId,
    createdById: userId,
    issuedBy: userName,
  }),
};
