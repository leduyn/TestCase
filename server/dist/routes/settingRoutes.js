"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settingController_1 = require("../controllers/settingController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/environments', settingController_1.SettingController.getEnvironments);
router.post('/environments', auth_1.optionalAuthenticate, settingController_1.SettingController.saveEnvironments);
exports.default = router;
