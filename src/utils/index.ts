export const getValueUsingPath = (
  record: Record<string, any>,
  path: string[]
) => {
  if (!record) return record;
  return path.length === 0
    ? record
    : path.reduce((record, item) => record[item], record);
};

export * from "./crawl";
export * from "./cursor";
