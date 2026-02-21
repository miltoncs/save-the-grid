# Project Tools

This directory contains utility scripts used to generate or transform project artifacts.

## Layout

- `terrain/`: terrain map generation scripts and interactive terrain lab.
- `terrain/compat/`: optional compatibility wrappers that forward to canonical terrain scripts.

## Rule

Tools should write outputs into runtime locations (`/assets`, `/data`) and never into `docs/`.
