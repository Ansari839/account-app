import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || "default_secret_CHANGE_ME_IN_PROD"
);

export const AuthUtils = {
    /**
     * Hash a plain text password.
     */
    async hashPassword(password: string): Promise<string> {
        const salt = await bcrypt.genSalt(10);
        return bcrypt.hash(password, salt);
    },

    /**
     * Compare plain text password with hash.
     */
    async comparePassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    },

    /**
     * Create a JWT token.
     */
    async signToken(payload: any, expiresIn: string = "8h"): Promise<string> {
        return new SignJWT(payload)
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime(expiresIn)
            .sign(JWT_SECRET);
    },

    /**
     * Verify and decode a JWT token.
     * Returns null if invalid or expired.
     */
    async verifyToken(token: string): Promise<any | null> {
        try {
            const { payload } = await jwtVerify(token, JWT_SECRET);
            return payload;
        } catch (err) {
            return null;
        }
    },
};
