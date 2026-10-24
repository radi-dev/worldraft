# Worldraft Build Guide

Build Worldraft one small capability at a time. Read a task, understand its result, then write the request in your own words. Follow the numbered order and keep earlier features working.

Each task names the local context to give your coding model and concrete test targets. Read only that context and the relevant code. `offline/` paths are inside `docs/`; `fixtures/` paths are inside `tests/`. The setup and downloaded material are explained in `docs/offline/README.md`.

Run `npm run test:offline` for deterministic tests without internet, model inference or Blender. Live model, Blender and rendering checks are separate and labelled below. Targets for unfinished tasks are goals, not results already achieved.

The stack remains React/Three.js, FastAPI, LangChain/LangGraph and Blender MCP. The first release is a small Lagos neighbourhood with two AI-authored styles, editable objects and walking. Multiplayer, whole-world generation and engineering simulations come later.

# Task 01 Scaffold

**Build:** Already implemented: one command starts FastAPI and the UI, with a cube, grid and live connection status.

**Offline context:** offline/README.md; existing source.

**Test targets:** Build + 11 current offline checks pass; live desktop browser opening remains manual.

**Learn:** Follow how the frontend requests backend health.

# Task 02 See what each control does

**Build:** Add a small activity panel showing which function runs when you click a control. Start with Reset View and a clearly labelled pretend Generate action.

**Offline context:** offline/VIEWPORT.md; controls.md.

**Test targets:** 20 simulated clicks → 20 trace entries; 1 thrown handler error → 1 error entry; 0 assets generated.

**Learn:** Add a Toggle Grid button and follow its function.

# Task 03 Move around the overview

**Build:** Allow panning, zooming and turning around the map. Keep the camera tilted downward so it cannot flip upside down. Add Reset View and North.

**Offline context:** offline/VIEWPORT.md; installed OrbitControls source.

**Test targets:** 100 scripted camera updates stay within angle/zoom limits; reset position differs by <0.000001 m.

**Learn:** Change the camera angle and zoom limits.

# Task 04 Select individual objects

**Build:** Show several test objects. Give each a permanent ID. Clicking one highlights it and shows its details in Properties.

**Offline context:** offline/VIEWPORT.md; fixtures/world.json.

**Test targets:** 20 IDs stay unique after reordering; 20 selection cases resolve the expected ID; 0 neighbours change.

**Learn:** Follow how a screen click finds a 3D object.

# Task 05 Edit objects and undo

**Build:** Add remove, replace and move actions, followed by Undo and Redo. Keep these actions in one shared place for buttons and future chat commands.

**Offline context:** fixtures/world.json; existing command code.

**Test targets:** Apply 100 edits then undo all: state equals the starting state exactly; invalid commands cause 0 changes.

**Learn:** Add a rename action with undo.

# Task 06 Save and reopen projects

**Build:** Save the world's objects, IDs, positions and asset references to a project file through FastAPI. Include a file-format version.

**Offline context:** fixtures/world.json; project file schema you define.

**Test targets:** 100-entity save/reopen keeps every ID and transform; 3 corrupt/version/path cases preserve the previous file.

**Learn:** Read the saved JSON and find one object's data.

# Task 07 Load and reuse 3D assets

**Build:** Load a small test GLB—a portable 3D model file. Place many copies that share geometry and materials. Try instancing, which draws compatible copies together.

**Offline context:** offline/VIEWPORT.md; fixtures/diagnostic-cube.glb.

**Test targets:** 20 copies share geometry; replacing 1 leaves 19 unchanged. Local render check: 20 unload cycles return to baseline resource counts.

**Learn:** Compare an asset with an individual placement of it.

# Task 08 Run work in the background

**Build:** Add a job system with progress, status and Cancel. Start with a clearly labelled simulated job running outside the API request.

**Offline context:** offline/AI_BLENDER.md; fake worker and clock.

**Test targets:** Cover all 5 job states and cancel/error/restart; cancelled jobs never succeed. Local process check: cancellation completes within 3 s.

**Learn:** Follow a job from the button to the worker and back.

# Task 09 Learn the LangGraph flow

**Build:** Run a practice workflow inside a job: read request → plan → simulated build → check → finish. Add a limited retry path.

**Offline context:** offline/AI_BLENDER.md; fixtures/generation.json.

**Test targets:** Pass, repair and permanent-failure cases take expected paths; no case exceeds 3 build attempts.

**Learn:** Change a check and predict which graph path will run.

# Task 10 Turn a description into a plan

**Build:** Connect a real LLM through LangChain. Turn “make a bungalow” into structured data: dimensions, parts, style and assumptions. Choose an open model that suits your hardware or endpoint.

**Offline context:** offline/AI_BLENDER.md; fixtures/generation.json; supply local model URL/ID.

**Test targets:** All 6 fixture responses produce the expected validation/error result. Separate live target: ≥8 of 10 prompts yield valid plans within 3 attempts.

**Learn:** Change one required field and inspect the model's response.

# Task 11 Connect to Blender

**Build:** Use [ahujasid/mcp-for-blender](https://github.com/ahujasid/mcp-for-blender). Connect to a dedicated Blender scene, list its tools and read scene information. Keep modelling and external asset services disabled.

**Offline context:** offline/AI_BLENDER.md; references/blender-mcp-tools.json; installed Blender path.

**Test targets:** Fake discovery/disconnect/reconnect/timeout all pass; only the 3 approved tool schemas are exposed. Real connection is a separate local check.

**Learn:** Trace studio → MCP client → MCP server → Blender add-on.

# Task 12 Build a test object through MCP

**Build:** Send a small, fixed Blender Python script through MCP. Create objects in a separate collection for that job, save a checkpoint and report errors.

**Offline context:** offline/AI_BLENDER.md; references/blender-api.json.

**Test targets:** Fake executor covers success/error/timeout. Local Blender check: 2 runs leave 1 job collection and preserve 5 unrelated objects.

**Learn:** Change a dimension in the script. Learn what Blender's bpy API does.

# Task 13 Generate the first bungalow

**Build:** Ask the LLM to write a Blender script for a low-poly bungalow with walls, roof, porch, door and windows. Run it through the existing job and MCP connection.

**Offline context:** offline/AI_BLENDER.md; generation fixtures; supply palette/style rules.

**Test targets:** Unit workflow uses 0 real inference calls. Separate live run must create all 5 component groups and retain the actual generated script.

**Learn:** Follow one requested feature from words to a Blender object.

# Task 14 Check and repair the result

**Build:** Check dimensions, required parts, ground placement and triangle count. Send specific failures back to the model. Limit the whole build to three attempts.

**Offline context:** fixtures/geometry-cases.json; offline/AI_BLENDER.md.

**Test targets:** All geometry cases pass/fail as labelled; base dimensions within 0.05 m; ≤20,000 triangles; ≤3 build attempts. Appearance needs human review.

**Learn:** Add one check and read the feedback sent to the model.

# Task 15 Bring the building into Three.js

**Build:** Export the generated building as GLB and load it in the studio. Save its Blender file, construction script, settings and preview together.

**Offline context:** offline/AI_BLENDER.md; fixtures/diagnostic-cube.glb.

**Test targets:** Missing bundle files are rejected. Local replay: dimensions differ by ≤0.01 m, component names match, and no model call occurs.

**Learn:** Compare the editable Blender source with the exported model.

# Task 16 Revise an asset with words

**Build:** Support requests such as “change the roof colour” or “widen the porch.” Build a new version, then let the user accept or discard it.

**Offline context:** generation fixtures; prior asset version.

**Test targets:** 2 revisions preserve untouched fields; discard restores the exact prior version; 3 other placements remain unchanged.

**Learn:** Compare the old and new settings and geometry.

# Task 17 Make reusable asset recipes

**Build:** Turn successful AI-written scripts into recipes with adjustable dimensions. Add a kiosk and water tank, then produce two styles of all three asset types.

**Offline context:** geometry fixtures; approved construction recipes.

**Test targets:** Parameter cases reject unsupported shapes. Local gate: 6 approved assets—3 categories × 2 styles—replay within 0.01 m of saved bounds.

**Learn:** Change a recipe parameter instead of asking AI to start again.

# Task 18 Switch styles with animation

**Build:** Group matching assets into style packs. Load the new assets, then animate sink → swap → rise. Reuse the animation for removal and replacement, with a reduced-motion option.

**Offline context:** offline/VIEWPORT.md; fake clock; 2 style mappings.

**Test targets:** 20 switch/remove/undo sequences preserve IDs and removals; failed loading leaves state unchanged. Local render check: no retained resource-count increase.

**Learn:** Separate temporary animation movement from saved object positions.

# Task 19 Import a small Lagos map

**Build:** Choose an area with roughly 30–50 building footprints. Import a saved OpenStreetMap extract, including roads. Convert coordinates to local metres and retain the source and attribution.

**Offline context:** offline/GEOGRAPHY.md; lagos-source.osm; projection-golden.json.

**Test targets:** Raw parser finds 723 nodes, 67 building ways and 33 road ways; golden coordinates agree within 0.01 m; unknown heights stay unknown.

**Learn:** Follow one real feature from map coordinates to the scene.

# Task 20 Build the neighbourhood

**Build:** Place the approved building recipes on supported footprints. Add road surfaces and simple rules for kiosks and tanks. Use known map facts first and clearly labelled assumptions where data is missing.

**Offline context:** offline/GEOGRAPHY.md; chosen source IDs; supply regional placement rules.

**Test targets:** Same seed/input produces identical placements; 0 props inside roads/buildings in the fixture; unsupported features are reported.

**Learn:** Change one placement rule and inspect the result.

# Task 21 Walk at street level

**Build:** Add human-height movement with ground and building collisions. Include normal and fast speeds. Clicking a valid street enters walk mode; Overview returns to the overhead view.

**Offline context:** offline/GEOGRAPHY.md; cached Rapier; synthetic ground/wall cases.

**Test targets:** Local physics: eye height within 0.02 m on flat ground; 0 wall crossings over 600 steps at 7 m/s; looking up adds no flight.

**Learn:** Separate camera direction from movement and collision handling. Use Rapier for the character controller.

# Task 22 Control the studio through chat

**Build:** Let chat call existing actions: switch style, remove the selected building, replace it, undo or focus an object. Ask for clarification when a request is unclear.

**Offline context:** offline/AI_BLENDER.md; fixtures/chat-cases.json.

**Test targets:** 12 recorded command cases map to the expected action or clarification; invalid IDs cause 0 edits; button/chat undo results match.

**Learn:** Follow a sentence into a tool call and then an existing action.

# Task 23 Use the engine without the UI

**Build:** Expose the existing services through a Python API and command-line commands. Support saved-recipe replay, world assembly and export.

**Offline context:** offline/AI_BLENDER.md; saved project and recipe.

**Test targets:** UI/API/CLI produce equal placement manifests; replay makes 0 inference calls. Local exports load in Three.js and Blender.

**Learn:** Write a short Python script that calls the same service as a button.

# Task 24 Measure and improve performance

**Build:** Measure loading time, frame rate, memory, model-generation success and repair attempts. Fix demonstrated bottlenecks using shared assets, simpler geometry or loading only what is needed.

**Offline context:** offline/TESTING.md; fixed world, prompts and named test hardware.

**Test targets:** Unit regression cases all pass. Local target: p95 frame time ≤33.3 ms over 60 s on a named device; report load time, bytes, attempts and failures.

**Learn:** Use the browser profiler to identify one actual bottleneck.

# Task 25 Prepare the open-source release

**Build:** Package the built UI with FastAPI. Document installation, startup, model and Blender setup, troubleshooting and contributions. Check code, data, model and asset licences separately.

**Offline context:** offline/README.md; dependency locks, licence files and caches.

**Test targets:** 1 clean offline install on the supported platform succeeds; all pack checksums match; scan finds 0 shipped credentials.

**Learn:** Separate what users need to run the tool from what developers need to build it.

# Task 26 Create the portfolio demo

**Build:** Prepare an interactive viewer with the saved Lagos scene, both styles, editing and walking. Add a short video and an explanation of how the AI pipeline works. Agree on a destination before publishing.

**Offline context:** saved world/styles; supply final portfolio text and publishing destination.

**Test targets:** Local demo: 2 visitor sessions keep independent edits; reset and 20 style switches work. Label pre-generated assets and unavailable chat.

**Learn:** Explain what happens during AI generation versus ordinary viewing.

# Working on one task

Use the Build line as your scope, explain the feature in your own words, and include the named local context. Try the result and do the learning exercise before moving on. Keep fake responses visibly labelled; they verify code behaviour, not AI quality.

Record passed, failed and skipped checks in the task notes. Never hide a missing local model or Blender behind a simulated success. See `docs/offline/TESTING.md` for shared test rules and measurement methods.
