import CharCodes from 'src/core/CharCodes';
import PDFCrossRefSection from 'src/core/document/PDFCrossRefSection';
import PDFHeader from 'src/core/document/PDFHeader';
import PDFTrailer from 'src/core/document/PDFTrailer';
import PDFTrailerDict from 'src/core/document/PDFTrailerDict';
import PDFContext from 'src/core/PDFContext';

// TODO: Unit test this!
class PDFWriter {
  static forContext = (context: PDFContext) => new PDFWriter(context);

  private readonly context: PDFContext;

  private constructor(context: PDFContext) {
    this.context = context;
  }

  serializeToPDF(): Uint8Array {
    const {
      size,
      header,
      indirectObjects,
      xref,
      trailerDict,
      trailer,
    } = this.computeBufferSize();

    let offset = 0;
    const buffer = new Uint8Array(size);

    offset += header.copyBytesInto(buffer, offset);
    buffer[offset++] = CharCodes.Newline;
    buffer[offset++] = CharCodes.Newline;

    // TODO: Make copyStringIntoBuffer() utility!
    for (
      let ioIdx = 0, ioLen = indirectObjects.length;
      ioIdx < ioLen;
      ioIdx++
    ) {
      const [ref, object] = indirectObjects[ioIdx];

      const objNum = String(ref.objectNumber);
      for (let idx = 0, len = objNum.length; idx < len; idx++) {
        buffer[offset++] = objNum.charCodeAt(idx);
      }
      buffer[offset++] = CharCodes.Space;

      const genNum = String(ref.generationNumber);
      for (let idx = 0, len = genNum.length; idx < len; idx++) {
        buffer[offset++] = genNum.charCodeAt(idx);
      }
      buffer[offset++] = CharCodes.Space;

      buffer[offset++] = CharCodes.o;
      buffer[offset++] = CharCodes.b;
      buffer[offset++] = CharCodes.j;
      buffer[offset++] = CharCodes.Newline;

      offset += object.copyBytesInto(buffer, offset);

      buffer[offset++] = CharCodes.Newline;
      buffer[offset++] = CharCodes.e;
      buffer[offset++] = CharCodes.n;
      buffer[offset++] = CharCodes.d;
      buffer[offset++] = CharCodes.o;
      buffer[offset++] = CharCodes.b;
      buffer[offset++] = CharCodes.j;
      buffer[offset++] = CharCodes.Newline;
      buffer[offset++] = CharCodes.Newline;
    }

    offset += xref.copyBytesInto(buffer, offset);
    buffer[offset++] = CharCodes.Newline;

    offset += trailerDict.copyBytesInto(buffer, offset);
    buffer[offset++] = CharCodes.Newline;
    buffer[offset++] = CharCodes.Newline;

    offset += trailer.copyBytesInto(buffer, offset);

    return buffer;
  }

  private computeBufferSize() {
    const { catalogRef, largestObjectNumber } = this.context;
    if (!catalogRef) throw new Error('FIX ME!');

    const header = PDFHeader.forVersion(1, 7);

    let size = header.sizeInBytes() + 2;

    const xref = PDFCrossRefSection.create();
    const indirectObjects = this.context.enumerateIndirectObjects();

    for (let idx = 0, len = indirectObjects.length; idx < len; idx++) {
      const [ref, object] = indirectObjects[idx];
      xref.addEntry(ref, size);

      const refSize = ref.sizeInBytes() + 2 + 1;
      const objectSize = object.sizeInBytes() + 1 + 6 + 2;

      size += refSize + objectSize;
    }

    const xrefOffset = size;
    size += xref.sizeInBytes() + 1;

    const trailerDict = PDFTrailerDict.of(
      this.context.obj({ Size: largestObjectNumber + 1, Root: catalogRef }),
    );
    size += trailerDict.sizeInBytes() + 2;

    const trailer = PDFTrailer.forLastCrossRefSectionOffset(xrefOffset);
    size += trailer.sizeInBytes();

    return { size, header, indirectObjects, xref, trailerDict, trailer };
  }
}

export default PDFWriter;
