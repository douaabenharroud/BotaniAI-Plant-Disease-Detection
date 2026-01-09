// Utility to generate unique IDs for all models matching your class diagram
const generateID = (prefix) => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}_${timestamp}_${random}`;
};

// Specific ID generators for each model
const IDGenerators = {
  user: () => generateID('user'),
  plant: () => generateID('plant'),
  device: () => generateID('device'),
  assignment: () => generateID('assign'),
  reading: () => generateID('reading'),
  analysis: () => generateID('analysis'),
  recommendation: () => generateID('rec'),
  image: () => generateID('img'),
  action: () => generateID('act'),
  feedback: () => generateID('fb')
};

module.exports = { generateID, ...IDGenerators };