// ============================================================
// BIS SAHAYAK AI — BRAHMASTRA SERVER
// Online AI → Local Ollama fallback
// Auth + Documents + Compliance + Dashboard + Health
// ============================================================

require("dotenv").config();

console.log("==========================================");
console.log("        BIS SAHAYAK AI - STARTING");
console.log("==========================================");

console.log("AI_API_URL:", process.env.AI_API_URL || "MISSING");
console.log("AI_API_KEY:", process.env.AI_API_KEY ? "LOADED" : "MISSING");
console.log("AI_MODEL:", process.env.AI_MODEL || "MISSING");
console.log("OLLAMA_URL:", process.env.OLLAMA_URL || "http://127.0.0.1:11434");
console.log("OLLAMA_MODEL:", process.env.OLLAMA_MODEL || "llama3.2:3b");
console.log("==========================================");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

// ============================================================
// APP
// ============================================================

const app = express();

const PORT = process.env.PORT || 5000;

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use(cors());

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ============================================================
// CONFIG
// ============================================================

const JWT_SECRET =
  process.env.JWT_SECRET || "CHANGE_THIS_SECRET_IN_PRODUCTION";

const AI_API_URL = process.env.AI_API_URL || "";

const AI_API_KEY = process.env.AI_API_KEY || "";

const AI_MODEL = process.env.AI_MODEL || "gemini-3.8-flash";

const OLLAMA_URL =
  process.env.OLLAMA_URL || "http://127.0.0.1:11434";

const OLLAMA_MODEL =
  process.env.OLLAMA_MODEL || "llama3.2:3b";

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "";

const WEB_SEARCH_URL =
  process.env.WEB_SEARCH_URL || "";

const WEB_SEARCH_KEY =
  process.env.WEB_SEARCH_KEY || "";

// ============================================================
// BIS OFFICIAL SOURCES
// ============================================================

const BIS_SOURCES = [
  {
    name: "Bureau of Indian Standards",
    url: "https://www.bis.gov.in/",
    type: "Official",
  },
  {
    name: "BIS Standards",
    url: "https://www.services.bis.gov.in/",
    type: "Official",
  },
  {
    name: "BIS Certification",
    url: "https://www.bis.gov.in/product-certification/",
    type: "Official",
  },
  {
    name: "BIS Hallmarking",
    url: "https://www.bis.gov.in/hallmarking/",
    type: "Official",
  },
  {
    name: "BIS Laboratories",
    url: "https://www.bis.gov.in/laboratory/",
    type: "Official",
  },
];

// ============================================================
// MONGODB SCHEMAS
// ============================================================

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      default: "user",
    },

    preferredLanguage: {
      type: String,
      default: "English",
    },
  },
  {
    timestamps: true,
  }
);

const DocumentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    fileName: String,

    mimeType: String,

    size: Number,

    sha256: String,

    status: {
      type: String,
      enum: ["valid", "renewal", "action_required", "unknown"],
      default: "unknown",
    },

    expiryDate: Date,

    category: String,
  },
  {
    timestamps: true,
  }
);

const ComplianceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: String,

    category: String,

    status: {
      type: String,
      enum: ["completed", "pending", "renewal", "action_required"],
      default: "pending",
    },

    dueDate: Date,

    notes: String,
  },
  {
    timestamps: true,
  }
);

const QuerySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    question: String,

    answer: String,

    mode: String,

    language: String,

    createdAt: {
      type: Date,
      default: Date.now,
    },
  }
);

const User = mongoose.model("User", UserSchema);
const Document = mongoose.model("Document", DocumentSchema);
const Compliance = mongoose.model(
  "Compliance",
  ComplianceSchema
);
const Query = mongoose.model("Query", QuerySchema);

// ============================================================
// MONGODB CONNECTION
// ============================================================

let mongoState = "disabled";

async function connectMongo() {
  if (!MONGO_URI) {
    mongoState = "offline/demo";
    console.log("MongoDB unavailable: offline/demo mode");
    return;
  }

  try {
    await mongoose.connect(MONGO_URI);

    mongoState = "connected";

    console.log("MongoDB connected successfully.");
  } catch (error) {
    mongoState = "offline";

    console.log(
      "MongoDB connection failed:",
      error.message
    );
  }
}

connectMongo();


// ============================================================
// AUTH MIDDLEWARE
// ============================================================

function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const token = header.substring(7);

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}

function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      error: "Admin access required",
    });
  }

  next();
}

// ============================================================
// AI SYSTEM PROMPT
// ============================================================

const SYSTEM_PROMPT = `
You are BIS Sahayak AI.

You are an AI assistant for Indian Standards,
BIS services, business compliance and related
business-support questions.

Your priorities:

1. Give useful and understandable answers.
2. Never invent BIS standards.
3. Never invent BIS clause numbers.
4. Never invent certification requirements.
5. Never invent fees.
6. Never invent deadlines.
7. Never invent laboratory information.
8. Never claim that a document is officially valid
   unless authoritative evidence is available.
9. Clearly distinguish verified information from
   assumptions or general guidance.
10. Encourage users to verify regulatory information
    against official BIS sources when required.
11. If the user asks about business, sales, marketing,
    customers, profit, MSME, startup or business problems,
    provide practical structured guidance.
12. If the question is outside your reliable knowledge,
    say what information is missing instead of hallucinating.
13. Keep answers professional and practical.
14. Do not pretend to be BIS itself.
15. BIS Sahayak AI is an independent assistant.

When appropriate, structure the answer as:

Answer
Why it matters
Recommended action
Important verification
Sources
`;

// ============================================================
// OFFLINE FALLBACK
// ============================================================

function offlineFallback(question) {
  const q = String(question || "").toLowerCase();

  if (
    q.includes("bis") &&
    (q.includes("certificate") ||
      q.includes("certification"))
  ) {
    return `
BIS certification generally involves determining
the applicable Indian Standard, checking the relevant
BIS certification scheme, fulfilling testing and
documentation requirements, and completing the applicable
BIS process.

The exact requirements depend on the product.

For an exact answer, identify the product name/model,
intended use and applicable Indian Standard.

Please verify the current requirements through the
official BIS sources before taking regulatory action.
`;
  }

  if (
    q.includes("business") ||
    q.includes("profit") ||
    q.includes("sales") ||
    q.includes("marketing")
  ) {
    return `
A practical business analysis should first identify:

1. Customer
2. Problem
3. Product/service
4. Cost structure
5. Revenue model
6. Sales channel
7. Customer acquisition
8. Retention
9. Main risks

If you describe your business and current problem,
I can break it down step by step.
`;
  }

  if (
    q.includes("hallmark") ||
    q.includes("gold") ||
    q.includes("jewellery")
  ) {
    return `
Hallmarking is a BIS-related quality and purity
framework for applicable precious-metal articles.

The exact requirements depend on the product,
metal, applicable rules and current BIS procedures.

Verify current requirements through official BIS
sources before making a compliance decision.
`;
  }

  return `
I am currently operating in local/offline mode.

I can still help with general business,
BIS-related concepts and structured problem solving.

For an authoritative regulatory answer,
please verify the applicable information
against official BIS documentation.
`;
}

// ============================================================
// ONLINE AI
// ============================================================

async function onlineAI(messages) {
  if (!AI_API_URL || !AI_API_KEY) {
    console.log("⚠️ Online AI configuration missing.");
    return null;
  }

  try {
    console.log("🤖 Trying ONLINE AI...");
    console.log("URL:", AI_API_URL);
    console.log("MODEL:", AI_MODEL);

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 30000);

    const response = await fetch(
      AI_API_URL,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AI_API_KEY}`,
        },

        body: JSON.stringify({
          model: AI_MODEL,

          messages,

          temperature: 0.2,

          max_tokens: 1800,
        }),

        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    const text = await response.text();

    console.log("ONLINE AI STATUS:", response.status);

    if (!response.ok) {
      console.log(
        "ONLINE AI RESPONSE:",
        text.substring(0, 1000)
      );

      return null;
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      console.log("Online AI returned invalid JSON.");
      return null;
    }

    const answer =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.text ||
      data?.candidates?.[0]?.content?.parts
        ?.map((x) => x.text || "")
        .join("") ||
      "";

    if (!answer.trim()) {
      console.log("Online AI returned empty answer.");
      return null;
    }

    console.log("✅ ONLINE AI RESPONSE RECEIVED");

    return answer.trim();
  } catch (error) {
    console.log(
      "❌ Online AI error:",
      error.message
    );

    return null;
  }
}

// ============================================================
// LOCAL OLLAMA
// ============================================================

async function ollamaAI(messages) {
  try {
    console.log(
      "🧠 Calling LOCAL OLLAMA:",
      OLLAMA_MODEL
    );

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 120000);

    const response = await fetch(
      `${OLLAMA_URL}/api/chat`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          model: OLLAMA_MODEL,

          messages,

          stream: false,

          options: {
            temperature: 0.2,
          },
        }),

        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    const text = await response.text();

    console.log(
      "OLLAMA STATUS:",
      response.status
    );

    if (!response.ok) {
      console.log(
        "OLLAMA ERROR:",
        text.substring(0, 1000)
      );

      return null;
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      console.log("Invalid Ollama JSON.");
      return null;
    }

    const answer =
      data?.message?.content || "";

    if (!answer.trim()) {
      console.log(
        "Ollama returned empty answer."
      );

      return null;
    }

    console.log(
      "✅ LOCAL AI RESPONSE RECEIVED"
    );

    return answer.trim();
  } catch (error) {
    console.log(
      "❌ Ollama error:",
      error.message
    );

    return null;
  }
}

// ============================================================
// MASTER AI ENGINE
// ONLINE → OLLAMA → OFFLINE
// ============================================================

async function runAI(question, language = "English") {
  const userQuestion = String(question || "").trim();

  if (!userQuestion) {
    return {
      answer: "Please enter a question.",
      mode: "validation",
    };
  }

  const messages = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },

    {
      role: "user",
      content: `
Preferred language: ${language}

User question:
${userQuestion}
`,
    },
  ];

  // ----------------------------------------------------------
  // 1. ONLINE AI
  // ----------------------------------------------------------

  const onlineAnswer = await onlineAI(messages);

  if (onlineAnswer) {
    return {
      answer: onlineAnswer,
      mode: "online",
    };
  }

  // ----------------------------------------------------------
  // 2. LOCAL OLLAMA
  // ----------------------------------------------------------

  console.log(
    "⚠️ Online AI unavailable; switching to local Ollama."
  );

  const localAnswer = await ollamaAI(messages);

  if (localAnswer) {
    return {
      answer: localAnswer,
      mode: "ollama",
    };
  }

  // ----------------------------------------------------------
  // 3. OFFLINE FALLBACK
  // ----------------------------------------------------------

  console.log(
    "⚠️ Ollama unavailable; switching to offline fallback."
  );

  return {
    answer: offlineFallback(userQuestion),
    mode: "offline",
  };
}

// ============================================================
// OLLAMA HEALTH CHECK
// ============================================================

async function checkOllama() {
  try {
    const response = await fetch(
      `${OLLAMA_URL}/api/tags`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      return {
        available: false,
        models: [],
      };
    }

    const data = await response.json();

    const models =
      data?.models?.map(
        (model) => model.name
      ) || [];

    return {
      available: true,
      models,
    };
  } catch {
    return {
      available: false,
      models: [],
    };
  }
}

// ============================================================
// WEB LOOKUP
// ============================================================

async function webLookup(query) {
  if (!WEB_SEARCH_URL || !WEB_SEARCH_KEY) {
    return {
      available: false,
      message: "Web search connector not configured.",
    };
  }

  try {
    const url =
      `${WEB_SEARCH_URL}?q=` +
      encodeURIComponent(query);

    const response = await fetch(
      url,
      {
        headers: {
          Authorization:
            `Bearer ${WEB_SEARCH_KEY}`,
        },
      }
    );

    const data = await response.json();

    return {
      available: true,
      data,
    };
  } catch (error) {
    return {
      available: false,
      error: error.message,
    };
  }
}

// ============================================================
// HEALTH
// ============================================================

app.get("/api/health", async (req, res) => {
  const ollama = await checkOllama();

  res.json({
    status: "ok",

    service: "BIS Sahayak AI",

    time: new Date().toISOString(),

    ai: {
      onlineConfigured:
        Boolean(AI_API_URL && AI_API_KEY),

      model: AI_MODEL,

      fallback: "Ollama",
    },

    ollama: {
      available: ollama.available,

      url: OLLAMA_URL,

      model: OLLAMA_MODEL,

      models: ollama.models,
    },

    webSearch: {
      configured:
        Boolean(
          WEB_SEARCH_URL &&
          WEB_SEARCH_KEY
        ),
    },

    mongodb: {
      state: mongoState,
    },
  });
});

// ============================================================
// SOURCES
// ============================================================

app.get("/api/sources", (req, res) => {
  res.json({
    sources: BIS_SOURCES,
  });
});

// ============================================================
// REGISTER
// ============================================================

app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
    } = req.body;

    if (
      !name ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        error:
          "Name, email and password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error:
          "Password must contain at least 6 characters.",
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error:
          "Database unavailable. Registration is temporarily unavailable.",
      });
    }

    const existing =
      await User.findOne({
        email: email.toLowerCase(),
      });

    if (existing) {
      return res.status(409).json({
        error:
          "An account with this email already exists.",
      });
    }

    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );

    const user =
      await User.create({
        name,
        email: email.toLowerCase(),
        passwordHash,
      });

    const token =
      jwt.sign(
        {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
        },
        JWT_SECRET,
        {
          expiresIn: "7d",
        }
      );

    res.json({
      success: true,

      token,

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(
      "REGISTER ERROR:",
      error
    );

    res.status(500).json({
      error:
        "Registration failed.",
    });
  }
});

// ============================================================
// LOGIN
// ============================================================

app.post("/api/auth/login", async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error:
          "Email and password are required.",
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error:
          "Database unavailable. Login is temporarily unavailable.",
      });
    }

    const user =
      await User.findOne({
        email: email.toLowerCase(),
      });

    if (!user) {
      return res.status(401).json({
        error:
          "Invalid email or password.",
      });
    }

    const valid =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!valid) {
      return res.status(401).json({
        error:
          "Invalid email or password.",
      });
    }

    const token =
      jwt.sign(
        {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
        },
        JWT_SECRET,
        {
          expiresIn: "7d",
        }
      );

    res.json({
      success: true,

      token,

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    );

    res.status(500).json({
      error:
        "Login failed.",
    });
  }
});

// ============================================================
// AI CHAT
// ============================================================

app.post(
  "/api/ai/chat",
  async (req, res) => {
    try {
      const {
        question,
        message,
        language,
      } = req.body;

      const userQuestion =
        question || message || "";

      const result =
        await runAI(
          userQuestion,
          language || "English"
        );

      // Save query if MongoDB is available
      if (
        mongoose.connection.readyState === 1
      ) {
        try {
          await Query.create({
            userId:
              req.user?.id || null,

            question:
              userQuestion,

            answer:
              result.answer,

            mode:
              result.mode,

            language:
              language || "English",
          });
        } catch {
          // Do not break AI response
        }
      }

      res.json({
        success: true,

        answer:
          result.answer,

        mode:
          result.mode,
      });
    } catch (error) {
      console.error(
        "AI CHAT ERROR:",
        error
      );

      res.status(500).json({
        error:
          "AI service failed.",
      });
    }
  }
);

// ============================================================
// LOCAL AI TEST
// ============================================================

app.get(
  "/api/ai/local-test",
  async (req, res) => {
    const result =
      await ollamaAI([
        {
          role: "system",
          content:
            "You are a helpful assistant.",
        },

        {
          role: "user",
          content:
            "Reply with: Local AI is working.",
        },
      ]);

    if (!result) {
      return res.status(503).json({
        success: false,
        message:
          "Ollama is unavailable.",
      });
    }

    res.json({
      success: true,
      model: OLLAMA_MODEL,
      answer: result,
    });
  }
);

// ============================================================
// LIVE SEARCH
// ============================================================

app.post(
  "/api/ai/live-search",
  async (req, res) => {
    try {
      const {
        query,
      } = req.body;

      if (!query) {
        return res.status(400).json({
          error:
            "Search query required.",
        });
      }

      const result =
        await webLookup(query);

      res.json(result);
    } catch (error) {
      res.status(500).json({
        error:
          "Live search failed.",
      });
    }
  }
);

// ============================================================
// COMPLIANCE
// ============================================================

app.get(
  "/api/compliance",
  authRequired,
  async (req, res) => {
    try {
      if (
        mongoose.connection.readyState !== 1
      ) {
        return res.json({
          success: true,
          mode: "demo",
          items: [],
        });
      }

      const items =
        await Compliance.find({
          userId: req.user.id,
        }).sort({
          dueDate: 1,
        });

      res.json({
        success: true,
        items,
      });
    } catch (error) {
      res.status(500).json({
        error:
          "Unable to load compliance data.",
      });
    }
  }
);

// ============================================================
// ADD COMPLIANCE ITEM
// ============================================================

app.post(
  "/api/compliance",
  authRequired,
  async (req, res) => {
    try {
      if (
        mongoose.connection.readyState !== 1
      ) {
        return res.status(503).json({
          error:
            "Database unavailable.",
        });
      }

      const item =
        await Compliance.create({
          userId: req.user.id,

          title:
            req.body.title || "",

          category:
            req.body.category || "",

          status:
            req.body.status || "pending",

          dueDate:
            req.body.dueDate || null,

          notes:
            req.body.notes || "",
        });

      res.json({
        success: true,
        item,
      });
    } catch (error) {
      res.status(500).json({
        error:
          "Unable to create compliance item.",
      });
    }
  }
);

// ============================================================
// DOCUMENT UPLOAD
// ============================================================

const upload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        10 * 1024 * 1024,
    },

    fileFilter:
      (req, file, cb) => {
        const allowed = [
          "application/pdf",
          "text/plain",
          "text/csv",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ];

        if (
          allowed.includes(
            file.mimetype
          )
        ) {
          cb(null, true);
        } else {
          cb(
            new Error(
              "Unsupported file type."
            )
          );
        }
      },
  });

// ============================================================
// DOCUMENT LIST
// ============================================================

app.get(
  "/api/documents",
  authRequired,
  async (req, res) => {
    try {
      if (
        mongoose.connection.readyState !== 1
      ) {
        return res.json({
          success: true,
          mode: "demo",
          documents: [],
        });
      }

      const documents =
        await Document.find({
          userId: req.user.id,
        }).sort({
          createdAt: -1,
        });

      res.json({
        success: true,
        documents,
      });
    } catch (error) {
      res.status(500).json({
        error:
          "Unable to load documents.",
      });
    }
  }
);

// ============================================================
// DOCUMENT UPLOAD
// ============================================================

app.post(
  "/api/documents/upload",
  authRequired,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error:
            "No file uploaded.",
        });
      }

      if (
        mongoose.connection.readyState !== 1
      ) {
        return res.status(503).json({
          error:
            "Database unavailable.",
        });
      }

      const sha256 =
        crypto
          .createHash("sha256")
          .update(req.file.buffer)
          .digest("hex");

      const document =
        await Document.create({
          userId:
            req.user.id,

          fileName:
            req.file.originalname,

          mimeType:
            req.file.mimetype,

          size:
            req.file.size,

          sha256,

          status:
            req.body.status ||
            "unknown",

          expiryDate:
            req.body.expiryDate ||
            null,

          category:
            req.body.category ||
            "General",
        });

      res.json({
        success: true,

        document: {
          id:
            document._id,

          fileName:
            document.fileName,

          mimeType:
            document.mimeType,

          size:
            document.size,

          status:
            document.status,

          expiryDate:
            document.expiryDate,

          category:
            document.category,
        },
      });
    } catch (error) {
      console.error(
        "UPLOAD ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Document upload failed.",
      });
    }
  }
);

// ============================================================
// DASHBOARD
// ============================================================

app.get(
  "/api/dashboard",
  authRequired,
  async (req, res) => {
    try {
      if (
        mongoose.connection.readyState !== 1
      ) {
        return res.json({
          success: true,

          mode: "demo",

          stats: {
            documents: 0,
            validDocuments: 0,
            renewalDocuments: 0,
            actionRequired: 0,
            compliancePending: 0,
            complianceCompleted: 0,
          },
        });
      }

      const documents =
        await Document.find({
          userId: req.user.id,
        });

      const compliance =
        await Compliance.find({
          userId: req.user.id,
        });

      const stats = {
        documents:
          documents.length,

        validDocuments:
          documents.filter(
            d =>
              d.status === "valid"
          ).length,

        renewalDocuments:
          documents.filter(
            d =>
              d.status === "renewal"
          ).length,

        actionRequired:
          documents.filter(
            d =>
              d.status ===
              "action_required"
          ).length,

        compliancePending:
          compliance.filter(
            c =>
              c.status ===
                "pending" ||
              c.status ===
                "action_required" ||
              c.status ===
                "renewal"
          ).length,

        complianceCompleted:
          compliance.filter(
            c =>
              c.status ===
              "completed"
          ).length,
      };

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      res.status(500).json({
        error:
          "Unable to load dashboard.",
      });
    }
  }
);

// ============================================================
// FEEDBACK
// ============================================================

app.post(
  "/api/feedback",
  async (req, res) => {
    try {
      console.log(
        "USER FEEDBACK:",
        req.body
      );

      res.json({
        success: true,
        message:
          "Feedback received.",
      });
    } catch {
      res.status(500).json({
        error:
          "Feedback failed.",
      });
    }
  }
);

// ============================================================
// ADMIN STATS
// ============================================================

app.get(
  "/api/admin/stats",
  authRequired,
  adminRequired,
  async (req, res) => {
    try {
      if (
        mongoose.connection.readyState !== 1
      ) {
        return res.json({
          success: true,
          mode: "demo",
          stats: {},
        });
      }

      const [
        users,
        documents,
        compliance,
        queries,
      ] =
        await Promise.all([
          User.countDocuments(),

          Document.countDocuments(),

          Compliance.countDocuments(),

          Query.countDocuments(),
        ]);

      res.json({
        success: true,

        stats: {
          users,
          documents,
          compliance,
          queries,
        },
      });
    } catch (error) {
      res.status(500).json({
        error:
          "Unable to load admin statistics.",
      });
    }
  }
);

// ============================================================
// STATIC FRONTEND
// ============================================================

const publicPath =
  path.join(
    __dirname,
    "public"
  );

if (
  fs.existsSync(publicPath)
) {
  app.use(
    express.static(
      publicPath
    )
  );
}

// ============================================================
// SPA FALLBACK
// ============================================================

app.get(
  "*",
  (req, res) => {
    if (
      req.path.startsWith("/api/")
    ) {
      return res.status(404).json({
        error:
          "API endpoint not found.",
      });
    }

    const indexPath =
      path.join(
        publicPath,
        "index.html"
      );

    if (
      fs.existsSync(indexPath)
    ) {
      return res.sendFile(
        indexPath
      );
    }

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>BIS Sahayak AI</title>
          <meta charset="UTF-8">
        </head>

        <body>
          <h1>BIS Sahayak AI</h1>
          <p>Backend is running.</p>
          <p>API: /api/health</p>
        </body>
      </html>
    `);
  }
);

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    console.error(
      "GLOBAL ERROR:",
      err
    );

    if (
      err instanceof multer.MulterError
    ) {
      return res.status(400).json({
        error:
          err.message,
      });
    }

    res.status(500).json({
      error:
        err.message ||
        "Internal server error.",
    });
  }
);

// ============================================================
// START SERVER
// ============================================================

app.listen(
  PORT,
  () => {
    console.log("");
    console.log(
      "=========================================="
    );

    console.log(
      "🚀 BIS SAHAYAK AI IS RUNNING"
    );

    console.log(
      `🌐 http://localhost:${PORT}`
    );

    console.log(
      `❤️  Health: http://localhost:${PORT}/api/health`
    );

    console.log(
      `🧠 Local AI: ${OLLAMA_MODEL}`
    );

    console.log(
      `🤖 Online AI: ${
        AI_API_KEY
          ? "CONFIGURED"
          : "NOT CONFIGURED"
      }`
    );

    console.log(
      `🗄️ MongoDB: ${mongoState}`
    );

    console.log(
      "=========================================="
    );

    console.log("");
  }
);