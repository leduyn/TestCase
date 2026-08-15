"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const executionController_1 = require("../controllers/executionController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/:testCaseId/execute', auth_1.authenticate, executionController_1.ExecutionController.executeTestCase);
router.get('/:testCaseId/history', auth_1.authenticate, executionController_1.ExecutionController.getHistory);
exports.default = router;
