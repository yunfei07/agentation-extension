# Browser Extension + Playwright Python Generation + FastAPI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Chrome extension that reuses Agentation annotations and generates Playwright Python scripts through a FastAPI backend connected to an OpenAI-compatible LLM API.

**Architecture:** Keep existing `mcp` service responsible for annotation sync while introducing a separate Python backend for script generation. The extension content script mounts Agentation in-page, collects annotation events, and calls the backend when users click a generate button.

**Tech Stack:** TypeScript + React + Chrome MV3 extension, FastAPI + Pydantic + httpx, pytest.
