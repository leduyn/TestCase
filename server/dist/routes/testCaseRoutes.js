"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const testCaseController_1 = require("../controllers/testCaseController");
const importController_1 = require("../controllers/importController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});
router.post('/', auth_1.optionalAuthenticate, testCaseController_1.TestCaseController.createTestCase);
router.post('/generate', auth_1.optionalAuthenticate, upload.single('file'), testCaseController_1.TestCaseController.generate);
router.post('/import/preview', auth_1.optionalAuthenticate, upload.single('file'), importController_1.ImportController.preview);
router.post('/import', auth_1.optionalAuthenticate, upload.single('file'), importController_1.ImportController.import);
router.get('/suites', auth_1.optionalAuthenticate, testCaseController_1.TestCaseController.getSuites);
router.get('/suites/:id', auth_1.optionalAuthenticate, testCaseController_1.TestCaseController.getSuiteById);
router.put('/:id', auth_1.optionalAuthenticate, testCaseController_1.TestCaseController.updateTestCase);
router.delete('/:id', auth_1.optionalAuthenticate, testCaseController_1.TestCaseController.deleteTestCase);
exports.default = router;
