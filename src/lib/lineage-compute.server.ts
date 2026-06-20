export type LineageParent = {
  fullName: string;
  isInKin: boolean;
  generationLevel: number;
  lineagePathFather: string;
  lineagePathMother: string;
};

export function computeLineageFields(
  fullName: string,
  isRoot: boolean,
  father?: LineageParent | null,
  mother?: LineageParent | null,
) {
  if (isRoot) {
    return {
      generationLevel: 1,
      isInKin: true,
      lineagePathFather: fullName,
      lineagePathMother: fullName,
    };
  }

  let fInKin = false;
  let mInKin = false;
  let fGen = 0;
  let mGen = 0;
  let lineagePathFather = "No path";
  let lineagePathMother = "No path";

  if (father) {
    fInKin = father.isInKin;
    fGen = father.generationLevel;
    if (fInKin) lineagePathFather = `${father.lineagePathFather} > ${fullName}`;
  }

  if (mother) {
    mInKin = mother.isInKin;
    mGen = mother.generationLevel;
    if (mInKin) {
      lineagePathMother =
        mother.lineagePathFather !== "No path"
          ? `${mother.lineagePathFather} > ${fullName}`
          : `${mother.lineagePathMother} > ${fullName}`;
    }
  }

  const generationLevel = Math.max(fGen, mGen) + 1;
  return {
    generationLevel: generationLevel < 1 ? 1 : generationLevel,
    isInKin: fInKin || mInKin,
    lineagePathFather,
    lineagePathMother,
  };
}
