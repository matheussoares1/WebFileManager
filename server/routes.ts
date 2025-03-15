import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import multer from "multer";
import path from "path";
import { storage } from "./storage";
import fs from "fs/promises";
import { WebSocketServer } from 'ws';

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

async function ensureAdmin(req: Request, res: Response, next: Function) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

async function ensureFileAccess(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  const fileId = parseInt(req.params.fileId);
  const file = await storage.getFile(fileId);

  if (!file) {
    return res.status(404).json({ message: "File not found" });
  }

  // Admin or file owner has full access
  if (req.user.isAdmin || file.uploadedBy === req.user.id) {
    return next();
  }

  // Check user permissions
  const permission = await storage.getUserFilePermission(fileId, req.user.id);
  if (!permission || !permission.canRead) {
    return res.status(403).json({ message: "Access denied" });
  }

  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // File routes
  app.get("/api/files", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const files = await storage.getFiles();

    // Filter files based on permissions
    const accessibleFiles = await Promise.all(
      files.map(async (file) => {
        if (req.user!.isAdmin || file.uploadedBy === req.user!.id) {
          return file;
        }
        const permission = await storage.getUserFilePermission(file.id, req.user!.id);
        return permission?.canRead ? file : null;
      })
    );

    res.json(accessibleFiles.filter(Boolean));
  });

  app.post("/api/files", upload.single("file"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    try {
      const file = await storage.createFile({
        name: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: req.user.id,
      });
      res.status(201).json(file);
    } catch (error) {
      await fs.unlink(req.file.path);
      res.status(500).json({ message: "Failed to save file" });
    }
  });

  app.get("/api/files/:id", ensureFileAccess, async (req, res) => {
    const file = await storage.getFile(parseInt(req.params.id));
    if (!file) return res.status(404).json({ message: "File not found" });

    // Para arquivos de texto, lê e envia o conteúdo diretamente
    if (file.mimeType.startsWith("text/") || file.mimeType === "application/json") {
      try {
        const content = await fs.readFile(file.path, "utf-8");
        res.type(file.mimeType).send(content);
      } catch (error) {
        res.status(500).json({ message: "Failed to read file" });
      }
    } else {
      // Para outros arquivos, configura o cabeçalho corretamente
      const isPreviewable = file.mimeType.startsWith("image/") || 
                          file.mimeType === "application/pdf";

      res.setHeader(
        "Content-Disposition", 
        `${isPreviewable ? "inline" : "attachment"}; filename="${file.name}"`
      );
      res.setHeader("Content-Type", file.mimeType);

      // Envia o arquivo
      res.sendFile(path.resolve(process.cwd(), file.path));
    }
  });

  app.delete("/api/files/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.user.isAdmin) return res.sendStatus(403);

    const file = await storage.getFile(parseInt(req.params.id));
    if (!file) return res.status(404).json({ message: "File not found" });

    await fs.unlink(file.path);
    await storage.deleteFile(file.id);
    res.sendStatus(200);
  });

  // File permissions routes
  app.get("/api/files/:fileId/permissions", ensureFileAccess, async (req, res) => {
    const permissions = await storage.getFilePermissions(parseInt(req.params.fileId));
    res.json(permissions);
  });

  app.post("/api/files/:fileId/permissions", ensureFileAccess, async (req, res) => {
    const fileId = parseInt(req.params.fileId);
    const file = await storage.getFile(fileId);

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    // Only file owner or admin can add permissions
    if (!req.user!.isAdmin && file.uploadedBy !== req.user!.id) {
      const permission = await storage.getUserFilePermission(fileId, req.user!.id);
      if (!permission?.canShare) {
        return res.status(403).json({ message: "You don't have permission to share this file" });
      }
    }

    try {
      const permission = await storage.createFilePermission({
        fileId,
        userId: req.body.userId,
        canRead: req.body.canRead ?? true,
        canWrite: req.body.canWrite ?? false,
        canShare: req.body.canShare ?? false,
      });
      res.status(201).json(permission);
    } catch (error) {
      res.status(400).json({ message: "Invalid permission data" });
    }
  });

  app.patch("/api/files/:fileId/permissions/:permissionId", ensureFileAccess, async (req, res) => {
    const fileId = parseInt(req.params.fileId);
    const permissionId = parseInt(req.params.permissionId);
    const file = await storage.getFile(fileId);

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    // Only file owner or admin can modify permissions
    if (!req.user!.isAdmin && file.uploadedBy !== req.user!.id) {
      return res.status(403).json({ message: "You don't have permission to modify sharing settings" });
    }

    try {
      const permission = await storage.updateFilePermission(permissionId, {
        canRead: req.body.canRead,
        canWrite: req.body.canWrite,
        canShare: req.body.canShare,
      });
      res.json(permission);
    } catch (error) {
      res.status(400).json({ message: "Invalid permission data" });
    }
  });

  app.delete("/api/files/:fileId/permissions/:permissionId", ensureFileAccess, async (req, res) => {
    const fileId = parseInt(req.params.fileId);
    const file = await storage.getFile(fileId);

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    // Only file owner or admin can delete permissions
    if (!req.user!.isAdmin && file.uploadedBy !== req.user!.id) {
      return res.status(403).json({ message: "You don't have permission to modify sharing settings" });
    }

    await storage.deleteFilePermission(parseInt(req.params.permissionId));
    res.sendStatus(200);
  });

  // Admin routes
  app.get("/api/users", ensureAdmin, async (req, res) => {
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.delete("/api/users/:id", ensureAdmin, async (req, res) => {
    await storage.deleteUser(parseInt(req.params.id));
    res.sendStatus(200);
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.on('message', (message) => {
      // Broadcast file permission changes to all connected clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    });
  });

  return httpServer;
}