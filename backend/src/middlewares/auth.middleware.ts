import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";

interface AccessTokenPayload extends JwtPayload {
    id: string;
}

export const verifyJWT = asyncHandler(async (req, res, next) => {
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

    if(!token) {
        throw new ApiError(401, "Unauthorized: No token provided");
    }

    let decodedToken: AccessTokenPayload;

    try {
        const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET);

        if (typeof decoded === "string") {
            throw new ApiError(401, "Unauthorized: Invalid token");
        }

        decodedToken = decoded as AccessTokenPayload;
    } catch (err) {
        throw new ApiError(401, "Unauthorized: Invalid token");
    }

    const user = await prisma.user.findUnique({
        where: { id: decodedToken.id }
    });

    if(!user) {
        throw new ApiError(401, "Unauthorized: User not found");
    }

    req.user = user;

    next();
});