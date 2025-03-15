import { users, type User, type InsertUser, files, type File, type InsertFile, filePermissions, type FilePermission, type InsertFilePermission } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: number): Promise<void>;

  getFiles(): Promise<File[]>;
  getFile(id: number): Promise<File | undefined>;
  createFile(file: InsertFile): Promise<File>;
  deleteFile(id: number): Promise<void>;

  // New methods for file permissions
  getFilePermissions(fileId: number): Promise<FilePermission[]>;
  getUserFilePermission(fileId: number, userId: number): Promise<FilePermission | undefined>;
  createFilePermission(permission: InsertFilePermission): Promise<FilePermission>;
  updateFilePermission(id: number, permission: Partial<InsertFilePermission>): Promise<FilePermission>;
  deleteFilePermission(id: number): Promise<void>;

  sessionStore: session.SessionStore;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser & { isAdmin?: boolean }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, isAdmin: insertUser.isAdmin || false })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getFiles(): Promise<File[]> {
    return await db.select().from(files);
  }

  async getFile(id: number): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file;
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    const [file] = await db
      .insert(files)
      .values(insertFile)
      .returning();
    return file;
  }

  async deleteFile(id: number): Promise<void> {
    await db.delete(files).where(eq(files.id, id));
  }

  // File permissions methods
  async getFilePermissions(fileId: number): Promise<FilePermission[]> {
    return await db
      .select()
      .from(filePermissions)
      .where(eq(filePermissions.fileId, fileId));
  }

  async getUserFilePermission(fileId: number, userId: number): Promise<FilePermission | undefined> {
    const [permission] = await db
      .select()
      .from(filePermissions)
      .where(
        and(
          eq(filePermissions.fileId, fileId),
          eq(filePermissions.userId, userId)
        )
      );
    return permission;
  }

  async createFilePermission(permission: InsertFilePermission): Promise<FilePermission> {
    const [newPermission] = await db
      .insert(filePermissions)
      .values(permission)
      .returning();
    return newPermission;
  }

  async updateFilePermission(
    id: number,
    permission: Partial<InsertFilePermission>
  ): Promise<FilePermission> {
    const [updatedPermission] = await db
      .update(filePermissions)
      .set(permission)
      .where(eq(filePermissions.id, id))
      .returning();
    return updatedPermission;
  }

  async deleteFilePermission(id: number): Promise<void> {
    await db.delete(filePermissions).where(eq(filePermissions.id, id));
  }
}

export const storage = new DatabaseStorage();