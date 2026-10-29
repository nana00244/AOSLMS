import type { HubLesson, HubQuestion } from '../catalog';

const sourceUrl = 'https://mingycomputersgh.wordpress.com/wp-content/uploads/2023/10/science.pdf';
type Item = [string, string, string[], string];
function questions(prefix: string, items: Item[]): HubQuestion[] {
  return items.map(([id, prompt, options, explanation]) => ({
    id: `${prefix}-${id}`,
    prompt,
    options,
    answer: 0,
    explanation,
  }));
}
/** Original questions mapped to the two living-cell indicators on PDF pages 42–43.
 * Practical drawing/model-building evidence remains a teacher-assessed activity.
 */
export const livingCellLessons: HubLesson[] = [
  {
    id: 'b7-science-animal-cell-indicator',
    title: 'Animal cells: structures and functions',
    subject: 'Science',
    level: 'B7',
    strand: 'Diversity of matter: Living cells',
    standard: 'B7.1.2.1.1',
    description: 'Identify animal-cell structures and explain how their functions support life.',
    sourceUrl,
    sourceTitle: 'NaCCA Science CCP, content indicator B7.1.2.1.1, PDF page 42',
    body: [
      'An animal is made of cells. A cell is a small living unit with structures that carry out different tasks. The membrane surrounds the cell, the cytoplasm fills much of its interior, and a typical animal cell contains a nucleus and mitochondria.',
      'The cell membrane controls the exchange of materials with the surroundings. Nutrients and oxygen can enter while waste products can leave. The membrane is a selective boundary, not a rigid cellulose wall.',
      'The nucleus contains genetic information and helps direct cell activities. Many chemical reactions occur in the cytoplasm. Mitochondria transfer energy from food during aerobic respiration; this energy supports processes such as movement and growth.',
      'A muscle cell needs energy to contract. Having many mitochondria helps meet that need. Structures work together: materials enter through the membrane and are used by processes inside the cell. One structure cannot do every job.',
      'Examine a teacher-provided animal-cell image. Draw its outline and label the membrane, cytoplasm and nucleus; add mitochondria if they are shown. Explain the job of each label. Use a model to show their arrangement. A teacher should check your drawing and explanation as well as your practice answers.',
    ],
    questions: questions('animal', [
      [
        'boundary',
        'Which structure controls what enters and leaves an animal cell?',
        ['Cell membrane', 'Nucleus', 'Mitochondrion', 'Cytoplasm'],
        'The membrane is the selective boundary. The nucleus stores genetic information; mitochondria support respiration; cytoplasm hosts many reactions.',
      ],
      [
        'information',
        'Where is most genetic information kept in a typical animal cell?',
        ['Nucleus', 'Cell membrane', 'Outside the cell', 'Cellulose wall'],
        'The nucleus contains most of the genetic information in a typical animal cell. Animal cells do not have cellulose walls.',
      ],
      [
        'reactions',
        'Which part of the cell is the site of many chemical reactions?',
        ['Cytoplasm', 'Cellulose wall', 'Chloroplast', 'Space outside the cell'],
        'Many reactions take place in the cytoplasm. Chloroplasts and cellulose walls are not animal-cell structures.',
      ],
      [
        'energy',
        'Which structure helps transfer energy from food during aerobic respiration?',
        ['Mitochondrion', 'Cell membrane only', 'Cellulose wall', 'Chloroplast'],
        'Mitochondria are involved in aerobic respiration, which transfers energy from food for cell activities.',
      ],
      [
        'muscle',
        'Why do active muscle cells contain many mitochondria?',
        [
          'Muscle contraction requires energy',
          'Muscle cells make food by photosynthesis',
          'Mitochondria replace every nucleus',
          'Mitochondria form a cellulose wall',
        ],
        'Contraction needs energy. Many mitochondria help a muscle cell meet this demand through respiration.',
      ],
      [
        'model-boundary',
        'A model uses a thin flexible layer around an animal cell. What does that layer represent?',
        ['Cell membrane', 'Nucleus', 'Mitochondrion', 'Chloroplast'],
        'The cell membrane forms the flexible outer boundary of an animal cell. A nucleus is inside the cell.',
      ],
      [
        'model-interior',
        'A model fills the space inside the membrane around the organelles with jelly. What does the jelly represent?',
        ['Cytoplasm', 'Cellulose', 'A leaf', 'A whole organ'],
        'Cytoplasm occupies the cell interior around the organelles. The model is a simplified representation, not a literal copy of cell material.',
      ],
      [
        'missing-membrane',
        'If the cell membrane is badly damaged, which function is most directly affected?',
        [
          'Controlling exchange with the surroundings',
          'Making a cellulose wall',
          'Absorbing light in chloroplasts',
          'Forming soil minerals',
        ],
        'Damage to the boundary disrupts controlled exchange and can allow cell contents to leak.',
      ],
      [
        'missing-nucleus',
        'A diagram of a typical animal cell labels the genetic-information store incorrectly as a mitochondrion. Which label should replace it?',
        ['Nucleus', 'Cell wall', 'Chloroplast', 'External space'],
        'At this level, the nucleus is identified as the main store of genetic information in a typical animal cell.',
      ],
      [
        'cell-evidence',
        'Microscope images from an animal’s skin and muscle both show cells. What conclusion does this support?',
        [
          'Different parts of the animal are made of cells',
          'Only skin is made of cells',
          'Every cell has exactly the same shape',
          'Animals are made of chloroplasts',
        ],
        'Finding cells in different tissues supports the conclusion that animals are cellular. It does not show that all cells have the same shape.',
      ],
      [
        'correct-pair',
        'Which structure–function pair is correct for an animal cell?',
        [
          'Nucleus — helps control cell activities',
          'Cell membrane — makes food using sunlight',
          'Cytoplasm — forms a rigid cellulose wall',
          'Mitochondrion — stores all food outside the cell',
        ],
        'The nucleus helps control activities through genetic information. The other pairs assign functions to the wrong structures.',
      ],
      [
        'plant-confusion',
        'Which label should be removed from a diagram of a typical animal cell?',
        ['Chloroplast', 'Nucleus', 'Cell membrane', 'Cytoplasm'],
        'Typical animal cells do not have chloroplasts. They obtain food rather than photosynthesising in chloroplasts.',
      ],
      [
        'whole-v-part',
        'How is a mitochondrion related to an animal cell?',
        [
          'It is a structure inside the cell',
          'It is a complete animal',
          'It is the whole cell membrane',
          'It is a tissue containing many cells',
        ],
        'A mitochondrion is an organelle inside a cell; it is not a tissue or a whole animal.',
      ],
      [
        'work-together',
        'Which explanation best describes structures working together in an animal cell?',
        [
          'Materials cross the membrane and are used in processes inside the cell',
          'The nucleus replaces the need for every other structure',
          'The membrane performs photosynthesis for the animal',
          'Every structure has exactly the same function',
        ],
        'Different structures have different roles, and these roles support one another. No single structure performs every cell function.',
      ],
      [
        'drawing',
        'Which arrangement is suitable for a simplified animal-cell drawing?',
        [
          'Membrane outside, cytoplasm inside, nucleus within the cytoplasm',
          'Nucleus around the outside with the membrane in its centre',
          'Chloroplasts outside a cellulose wall only',
          'All cell structures drawn outside the membrane',
        ],
        'The membrane encloses the cytoplasm and internal structures, including a nucleus in a typical animal cell.',
      ],
      [
        'respiration-error',
        'A learner says mitochondria make energy from nothing. Which correction is best?',
        [
          'Respiration transfers energy from food into forms the cell can use',
          'Mitochondria are empty spaces with no function',
          'Mitochondria make all food using sunlight',
          'Only the membrane can use food',
        ],
        'Energy is transferred, not created from nothing. Mitochondria take part in aerobic respiration.',
      ],
    ]),
  },
  {
    id: 'b7-science-plant-cell-indicator',
    title: 'Plant cells: organelles and their jobs',
    subject: 'Science',
    level: 'B7',
    strand: 'Diversity of matter: Living cells',
    standard: 'B7.1.2.1.2',
    description: 'Explain the functions of structures in a typical plant cell.',
    sourceUrl,
    sourceTitle: 'NaCCA Science CCP, content indicator B7.1.2.1.2, PDF page 43',
    body: [
      'Plant cells share several structures with animal cells: a membrane, cytoplasm, nucleus and mitochondria. A plant cell also has a cellulose cell wall outside the membrane. A typical mature plant cell has a large central vacuole containing cell sap.',
      'The wall strengthens and supports the cell. The membrane controls exchange. These are different jobs: the wall does not replace the membrane. The vacuole stores cell sap, and water within it helps keep a cell firm by pressing the cell contents against the wall.',
      'Chloroplasts contain chlorophyll, which absorbs light used in photosynthesis. Many leaf cells have chloroplasts. Root cells growing underground usually do not, so it is incorrect to draw chloroplasts in every plant cell without considering the cell’s role.',
      'Plants respire as well as photosynthesise. Mitochondria transfer energy from food during aerobic respiration. A leaf cell may therefore contain both chloroplasts and mitochondria; one does not replace the other.',
      'Draw and label a plant cell from a teacher-provided image. Add a short function next to each label and build a simple model showing the wall outside the membrane. Compare cells from different plant parts and explain why their structures may differ. Your teacher should assess the drawing, model and explanation.',
    ],
    questions: questions('plant', [
      [
        'wall',
        'Which structure strengthens a plant cell outside its membrane?',
        ['Cellulose cell wall', 'Nucleus', 'Chloroplast', 'Cytoplasm'],
        'The cellulose wall lies outside the membrane and provides strength and support.',
      ],
      [
        'chloroplast',
        'Which structure absorbs light for photosynthesis in many leaf cells?',
        ['Chloroplast', 'Nucleus', 'Cell wall', 'Vacuole'],
        'Chloroplasts contain chlorophyll, which absorbs light used in photosynthesis.',
      ],
      [
        'sap',
        'Which structure contains cell sap in a typical mature plant cell?',
        ['Large central vacuole', 'Cellulose wall', 'Nucleus', 'Space outside the membrane'],
        'The central vacuole contains cell sap and contributes to the firmness of the cell.',
      ],
      [
        'exchange',
        'A plant cell has a wall and a membrane. Which controls exchange with its surroundings?',
        ['Cell membrane', 'Cell wall alone', 'Chloroplast alone', 'Nucleus alone'],
        'The membrane controls exchange. The wall mainly supplies strength and support.',
      ],
      [
        'root',
        'Why do many root cells lack chloroplasts?',
        [
          'They usually do not receive light for photosynthesis',
          'They are not living cells',
          'They never need energy',
          'They do not have cell membranes',
        ],
        'Underground root cells generally do not photosynthesise because little or no light reaches them. They still live and respire.',
      ],
      [
        'both',
        'Why can a leaf cell contain both chloroplasts and mitochondria?',
        [
          'It can photosynthesise and also respire',
          'Both structures perform exactly the same job',
          'Mitochondria are needed only in animals',
          'Chloroplasts replace all other cell structures',
        ],
        'Photosynthesis and respiration have different roles. Plant cells need energy for life processes and therefore respire.',
      ],
      [
        'firmness',
        'A plant cell loses much water from its vacuole. What is a likely result?',
        [
          'The cell becomes less firm',
          'The nucleus becomes a chloroplast',
          'The cell wall turns into cytoplasm',
          'The cell immediately makes more sunlight',
        ],
        'Loss of water reduces the pressure of the cell contents against the wall, making the cell less firm.',
      ],
      [
        'order',
        'Which order is correct when moving from outside a plant cell towards its interior?',
        [
          'Cell wall, cell membrane, cytoplasm',
          'Cytoplasm, cell wall, cell membrane',
          'Nucleus, cell wall, outside air',
          'Chloroplast, nucleus, cell wall',
        ],
        'The wall is outside the membrane; the membrane encloses the cytoplasm and other internal structures.',
      ],
      [
        'nucleus',
        'Which structure contains most genetic information in a typical plant cell?',
        ['Nucleus', 'Cell wall', 'Vacuole', 'Outside air'],
        'The nucleus contains most genetic information and helps direct activities in a typical plant cell.',
      ],
      [
        'cytoplasm',
        'Where do many chemical reactions occur in a plant cell?',
        [
          'Cytoplasm',
          'Only outside the cell wall',
          'Only in air around the leaf',
          'Only in the soil',
        ],
        'Many chemical reactions occur in the cytoplasm inside the cell.',
      ],
      [
        'model',
        'A model uses a firm outer box and a thin inner lining. Which labels fit these parts?',
        [
          'Cell wall and cell membrane',
          'Nucleus and chloroplast',
          'Vacuole and nucleus',
          'Cytoplasm and mitochondrion',
        ],
        'The firm box represents the supporting wall; the inner lining represents the membrane.',
      ],
      [
        'misconception',
        'Which statement about plant-cell energy processes is correct?',
        [
          'Plant cells use respiration to transfer energy from food',
          'Plants never respire because they photosynthesise',
          'The cell wall makes energy from nothing',
          'Only root cells can ever respire',
        ],
        'Plants respire to transfer energy from food for cell activities. Photosynthesis does not remove this need.',
      ],
      [
        'identify',
        'A cell image shows a cellulose wall and chloroplasts. Which identification is best supported?',
        [
          'A photosynthetic plant cell',
          'A typical animal muscle cell',
          'An empty space between cells',
          'A whole animal',
        ],
        'A cellulose wall and chloroplasts together are characteristic of photosynthetic plant cells.',
      ],
      [
        'compare',
        'Which pair is present in both typical plant and animal cells?',
        [
          'Cell membrane and nucleus',
          'Cellulose wall and chloroplast',
          'Chloroplast and large central vacuole',
          'Cellulose wall and large central vacuole',
        ],
        'Both typical plant and animal cells have a membrane and nucleus. The other pairs describe typical plant-cell features.',
      ],
      [
        'label-error',
        'A learner labels a chloroplast “stores cell sap”. Which structure should have that label?',
        ['Vacuole', 'Cell wall', 'Nucleus', 'Mitochondrion'],
        'The vacuole stores cell sap. Chloroplasts are involved in photosynthesis.',
      ],
      [
        'observe',
        'Leaf and root samples both show cells, but their structures differ. Which conclusion is supported?',
        [
          'Plants are made of cells that can have different roles',
          'All plant cells contain identical numbers of chloroplasts',
          'Root cells are not part of the plant',
          'A plant has only one cell',
        ],
        'Different plant parts contain cells adapted to their roles. Observing differences does not mean that one sample is not cellular.',
      ],
    ]),
  },
];
