declare module 'mammoth/mammoth.browser' {
  interface Options {
    arrayBuffer: ArrayBuffer;
  }

  interface ConversionResult {
    value: string;
    messages: unknown[];
  }

  function convertToHtml(options: Options): Promise<ConversionResult>;
  function extractRawText(options: Options): Promise<ConversionResult>;

  export { convertToHtml, extractRawText };
}
