"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDocument = parseDocument;
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const mammoth_1 = __importDefault(require("mammoth"));
async function parseDocument(fileBuffer, mimeType, filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (mimeType === 'application/pdf' || ext === 'pdf') {
        const data = await (0, pdf_parse_1.default)(fileBuffer);
        return data.text.trim();
    }
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        ext === 'docx') {
        const result = await mammoth_1.default.extractRawText({ buffer: fileBuffer });
        return result.value.trim();
    }
    // Default text formats (txt, md, json, csv)
    return fileBuffer.toString('utf-8').trim();
}
