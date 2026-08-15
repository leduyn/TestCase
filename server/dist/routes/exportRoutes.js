"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const exportController_1 = require("../controllers/exportController");
const router = (0, express_1.Router)();
router.get('/:suiteId/excel', exportController_1.ExportController.exportSuiteExcel);
exports.default = router;
