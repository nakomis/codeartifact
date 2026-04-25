export interface CodeArtifactErrorOptions {
  name: string;
  message: string;
}

export class CodeArtifactError extends Error {
  constructor({ name, message }: CodeArtifactErrorOptions) {
    super(message);
    this.name = name;
  }
}
