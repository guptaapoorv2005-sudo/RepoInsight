import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { registerUser, loginUser, logoutUser, changePassword, deleteUser, getCurrentUser, refreshAccessToken } from "../modules/user/user.controller.js";

const router = Router();

router.route("/register").post(registerUser);

router.route("/login").post(loginUser);

router.route("/logout").post(verifyJWT, logoutUser);

router.route("/change-password").patch(verifyJWT, changePassword);

router.route("/delete").delete(verifyJWT, deleteUser);

router.route("/current-user").get(verifyJWT, getCurrentUser);

router.route("/refresh-token").post(refreshAccessToken);

export default router;