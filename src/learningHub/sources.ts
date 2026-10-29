export interface CurriculumSource {
  title: string;
  url: string;
  description: string;
  levels: string[];
  subjects: string[];
}

const jhs = ['B7', 'B8', 'B9'];
const primary = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'];
const mirroredJhs = (subject: string, file: string): CurriculumSource => ({
  title: `${subject} · NaCCA B7–B9 curriculum`,
  url: `https://mingycomputersgh.wordpress.com/wp-content/uploads/2023/10/${file}.pdf`,
  description:
    'NaCCA curriculum PDF hosted by the supplied third-party archive. Opens the source document; external reading is not automatically scored.',
  levels: jhs,
  subjects: [subject],
});
export const curriculumSources: CurriculumSource[] = [
  {
    title: 'Mathematics · NaCCA B1–B3 curriculum',
    url: 'https://mingycomputersgh.wordpress.com/wp-content/uploads/2019/08/maths-lower-primary-b1-b3.pdf',
    description: 'NaCCA lower-primary Mathematics curriculum from the supplied archive.',
    levels: ['B1', 'B2', 'B3'],
    subjects: ['Mathematics'],
  },
  {
    title: 'NaCCA standards-based curriculum (2019)',
    url: 'https://nacca.gov.gh/learning-areas-subjects/new-standards-based-curriculum-2019/',
    description:
      'Official curriculum directory for primary learning areas. The site may be temporarily unavailable; the archive below provides additional access.',
    levels: ['KG1', 'KG2', ...primary],
    subjects: ['All subjects'],
  },
  {
    title: 'Ministry of Education curriculum resource hub',
    url: 'https://curriculumresources.edu.gh/',
    description:
      'Official portal with learner and teacher resources. Its current homepage focuses on SHS and also links to Basic and JHS levels; check each resource’s level before assigning.',
    levels: ['KG1', 'KG2', ...primary, ...jhs, 'SHS'],
    subjects: ['All subjects'],
  },
  {
    title: 'Primary and kindergarten curriculum archive',
    url: 'https://mingycomputersgh.wordpress.com/gesnacca-new-curriculum-for-2019/',
    description:
      'Supplied archive of 2019 curriculum documents: Mathematics, Science, English, Ghanaian Language, French, Computing, History, Creative Arts, RME, Physical Education, and Our World and Our People.',
    levels: ['KG1', 'KG2', ...primary],
    subjects: ['All subjects'],
  },
  {
    title: 'Common Core Programme B7–B9 archive',
    url: 'https://mingycomputersgh.wordpress.com/2023/10/21/download-the-new-gesnacca-curriculum-full-b7jhs1-to-b9jhs3/',
    description: 'Supplied index of NaCCA JHS curriculum documents across learning areas.',
    levels: jhs,
    subjects: ['All subjects'],
  },
  mirroredJhs('Mathematics', 'mathematics-1'),
  mirroredJhs('Science', 'science'),
  mirroredJhs('English Language', 'english-language'),
  mirroredJhs('Computing', 'computing'),
  mirroredJhs('Social Studies', 'social-studies'),
  mirroredJhs('Creative Arts and Design', 'creative-arts-and-design'),
  mirroredJhs('Career Technology', 'career-technology-k-9-3rd-aug.08.2021'),
  mirroredJhs('Religious and Moral Education', 'religious-and-moral-education'),
  mirroredJhs('Ghanaian Language', 'ghanaian-language'),
  mirroredJhs('Physical Education and Health', 'physical-education-and-health'),
  {
    title: 'Mathematics · NaCCA B4–B6 curriculum',
    url: 'https://mingycomputersgh.wordpress.com/wp-content/uploads/2019/08/maths-upper-primary-b4-b6.pdf',
    description:
      'Upper-primary curriculum PDF in the supplied archive. Curriculum reference rather than a scored in-app lesson.',
    levels: ['B4', 'B5', 'B6'],
    subjects: ['Mathematics'],
  },
  {
    title: 'Science · NaCCA B4–B6 curriculum',
    url: 'https://mingycomputersgh.wordpress.com/wp-content/uploads/2019/08/science-upper-primary-b4-b6.pdf',
    description:
      'Upper-primary curriculum PDF in the supplied archive. Curriculum reference rather than a scored in-app lesson.',
    levels: ['B4', 'B5', 'B6'],
    subjects: ['Science'],
  },
];
