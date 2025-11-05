"use strict";

const { z } = require("zod");

const signupSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(8).max(20).optional(),
  password: z.string().min(8).max(128)
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128)
});

module.exports = {
  signupSchema,
  loginSchema
};

