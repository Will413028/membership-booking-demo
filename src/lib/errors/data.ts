export class DataError extends Error {
  constructor() {
    super("Unable to load data.");
    this.name = "DataError";
  }
}
