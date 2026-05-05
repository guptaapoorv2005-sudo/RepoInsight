import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../utils/AsyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { env } from "../../config/env.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

const googleLogin = asyncHandler(async (req, res) => {
    const { credential } = req.body;

    if (!credential) {
        throw new ApiError(400, "Google token missing");
    }

    const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email || !payload.email_verified) {
        throw new ApiError(401, "Invalid Google account");
    }

    const { email, sub } = payload;

    let user = await prisma.user.findFirst({
        where: {
            OR: [
                { email },
                { googleId: sub }
            ]
        }
    });

    if (!user) {
        user = await prisma.user.create({
            data: {
                email,
                googleId: sub
            }
        });
    }
    else if (!user.googleId) {
        user = await prisma.user.update({
            where: { id: user.id },
            data: { googleId: sub }
        });
    }

    const { accessToken, refreshToken } = await generateRefreshAndAccessToken(user.id);

    await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken }
    });

    const sameSite: "none" | "lax" = env.NODE_ENV === "production" ? "none" : "lax";

    const accessTokenOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite,
        maxAge: 24 * 60 * 60 * 1000 
    }

    const refreshTokenOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite,
        maxAge: 10 * 24 * 60 * 60 * 1000 
    }

    return res
    .status(201)
    .cookie("accessToken", accessToken, accessTokenOptions)
    .cookie("refreshToken", refreshToken, refreshTokenOptions)
    .json(
        new ApiResponse(201,
            {
                id: user.id, email: user.email
            },
            "User logged in successfully"
        ) 
    )
});

const generateRefreshAndAccessToken = (userId: string) => {
    const accessToken = jwt.sign(
        {
            id: userId
        },
        env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: env.ACCESS_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"]
        }
    );

    const refreshToken = jwt.sign(
        {
            id: userId
        },
        env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: env.REFRESH_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"]
        }
    );

    return { accessToken, refreshToken };
};

const registerUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if(!email?.trim() || !password?.trim()) {
        throw new ApiError(400, "All fields are required");
    }

    const existingUser = await prisma.user.findUnique({ 
        where: { email }
    });

    if(existingUser) {
        throw new ApiError(409, "User with this email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
        }
    });

    const { accessToken, refreshToken } = generateRefreshAndAccessToken(newUser.id);

    await prisma.user.update({
        where: { id: newUser.id },
        data: { refreshToken }
    });

    const sameSite: "none" | "lax" = env.NODE_ENV === "production" ? "none" : "lax";

    const accessTokenOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite,
        maxAge: 24 * 60 * 60 * 1000 
    }

    const refreshTokenOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite,
        maxAge: 10 * 24 * 60 * 60 * 1000 
    }

    return res
    .status(201)
    .cookie("accessToken", accessToken, accessTokenOptions)
    .cookie("refreshToken", refreshToken, refreshTokenOptions)
    .json(
        new ApiResponse(201,
            {
                id: newUser.id, email: newUser.email
            },
            "User registered successfully"
        ) 
    )
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if(!email?.trim() || !password?.trim()) {
        throw new ApiError(400, "Email and password are required");
    }

    const user = await prisma.user.findUnique({
        where: { email }
    });

    if(!user) {
        throw new ApiError(404, "User not found");
    }

    if (!user.password) {
        throw new ApiError(400, "Please login using Google");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if(!isPasswordValid) {
        throw new ApiError(401, "Invalid credentials");
    }

    const { accessToken, refreshToken } = generateRefreshAndAccessToken(user.id);

    await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken }
    });

    const sameSite: "none" | "lax" = env.NODE_ENV === "production" ? "none" : "lax";

    const accessTokenOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite,
        maxAge: 24 * 60 * 60 * 1000 
    }

    const refreshTokenOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite,
        maxAge: 10 * 24 * 60 * 60 * 1000 
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, accessTokenOptions)
    .cookie("refreshToken", refreshToken, refreshTokenOptions)
    .json(
        new ApiResponse(200, 
            {
                id: user.id, email: user.email
            }, 
            "User logged in successfully"
        )
    )
});

const logoutUser = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    await prisma.user.update({
        where: { id: userId },
        data: { refreshToken: null }
    });

    const sameSite: "none" | "lax" = env.NODE_ENV === "production" ? "none" : "lax";

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, null, "User logged out successfully"));
});

type RefreshTokenPayload = jwt.JwtPayload & { id: string };

const refreshAccessToken = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if(!refreshToken) {
        throw new ApiError(401, "Refresh token is missing");
    }

    let decodedToken: RefreshTokenPayload;
    try {
        decodedToken = jwt.verify(refreshToken, env.REFRESH_TOKEN_SECRET) as RefreshTokenPayload;
    } catch (err) {
        throw new ApiError(401, "Invalid refresh token");
    }

    const user = await prisma.user.findUnique({
        where: { id: decodedToken.id }
    });

    if(!user || user.refreshToken !== refreshToken) {
        throw new ApiError(401, "Unauthorized: Invalid refresh token");
    }

    const { accessToken, refreshToken: newRefreshToken } = generateRefreshAndAccessToken(user.id);

    await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: newRefreshToken }
    });

    const sameSite: "none" | "lax" = env.NODE_ENV === "production" ? "none" : "lax";

    const accessTokenOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite,
        maxAge: 24 * 60 * 60 * 1000 
    }

    const refreshTokenOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite,
        maxAge: 10 * 24 * 60 * 60 * 1000 
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, accessTokenOptions)
    .cookie("refreshToken", newRefreshToken, refreshTokenOptions)
    .json( new ApiResponse(200, null, "Access token refreshed successfully") );
});

const getCurrentUser = asyncHandler(async (req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse( 200, req.user, "Current user fetched successfully"))
});

const changePassword = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    if(!currentPassword?.trim() || !newPassword?.trim()) {
        throw new ApiError(400, "Current and new passwords are required");
    }

    if(!req.user.password) {
        throw new ApiError(400, "Password change not allowed for Google accounts");
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, req.user.password);

    if(!isPasswordValid) {
        throw new ApiError(401, "Current password is incorrect");
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    const user = await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword }
    });

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Password updated successfully"));
});

const deleteUser = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    await prisma.user.delete({
        where: { id: userId }
    });

    return res
        .status(200)
        .json(new ApiResponse(200, null, "User deleted successfully"));
});

export {
    googleLogin,
    registerUser, 
    loginUser, 
    logoutUser, 
    refreshAccessToken, 
    getCurrentUser,
    changePassword, 
    deleteUser 
};