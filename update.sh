#!/bin/bash

export ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES=true

git stash save --keep-index
git pull
rm -rf node_modules
npm install
npm install