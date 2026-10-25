# UC-07: Generate a plan

- Feature: F6 AI plan generator (Vision §5, as changed by [ADR 0003](../../analysis-and-design/adr/0003-language-model-scope.md))
- Owner: Lâm
- Status: draft for the use-case model (PA2)
- Change from Vision v1.0: the model does not place courses. A **deterministic planner** builds the plan over the rule engine. The model only turns a goal written in the student's own words into the fields of the planning-goal form (the **goal box**), and the student reviews that form before planning. Vision v2 (Hoà) restates F6 to match.

## 1. Brief description

A student states what they want from a plan, either in the planning-goal form or in a sentence that fills the form for them. OmniCourse then builds a complete plan from the next term to graduation that breaks no academic rule, and explains why each course is placed where it is. The student can save it as one of their plans and edit it in the planner (UC-05).

## 2. Actors

- **Student** (primary).
- **Model provider** (secondary, only in steps 3–5): an AI model reached through OmniCourse's AI gateway. It receives the student's sentence and the course codes and names of their curriculum, never their identity or transcript.

## 3. Preconditions

- The student is signed in and has finished onboarding (UC-01).
- The student's curriculum (F12) and the rule engine (Triết) are available.

## 4. Basic flow

1. The student opens **Generate a plan**.
2. The system shows the **planning-goal form**, prefilled with the student's default planning goal from onboarding:
   - target graduation term;
   - credits per term;
   - internship term;
   - courses to take and courses to avoid.

   Above the form, a goal box invites the student to describe the goal in their own words. A note under it says that the text is sent to an AI provider, so names and student IDs should be left out.
3. The student types a goal, for example "graduate by summer 2028, at most 20 credits a term, internship in the third summer, no networking courses", and presses **Fill the form**.
4. The system sends the sentence and the course codes and names of the student's curriculum to the model, and asks for the form's fields as structured data.
5. The system checks the reply against the form's schema, fills the form with it, and highlights every field that changed.
6. The student reviews the form, corrects any field, and presses **Plan**.
7. The deterministic planner builds a plan from the next term to the target graduation term. It uses the student's transcript, curriculum and planning goal, and asks the rule engine to check every placement. While it works, the system shows progress.
8. The system shows the plan term by term, with the credits of each term. Each placed course carries the planner's reason for its place, such as "prerequisite CS162 is passed in the term before", "offered in main terms only" or "fills the elective group". The plan also shows its **estimated graduation term**.
9. The student presses **Save plan** and gives it a name.
10. The system saves it as a new plan, through the planner's plans API (Hoà), next to the student's other plans.

## 5. Alternative flows

**A1. Plan without the goal box.** At step 3 the student skips the goal box and edits the form directly. The flow continues at step 6. No model is involved.

**A2. AI unavailable.** At step 4 the gateway answers that AI is unavailable: no provider configured, the provider unreachable or timed out, the reply still not matching the form after one retry (gateway, PR #12), or the monthly budget spent. The system says the goal box is unavailable right now, leaves the form as it was, and the flow continues at A1. Planning itself never depends on the model (Robustness NFR).

**A3. Daily AI limit reached.** At step 4 the student has used their daily number of AI calls. The gateway gives the same "AI unavailable" answer with this reason, and the system says the goal box works again within 24 hours, as older calls leave the rolling window. The flow continues at A1.

**A4. Field outside what the program allows.** At step 5 or 6 a field asks for something the rules forbid, such as credits per term above the program's credit cap. The form keeps the value the student asked for. At step 7 the planner keeps every term inside the credit cap, and at step 8 the system says which part of the planning goal it could not meet and why, citing the rule. The model never changes a value to fit a rule.

**A5. Goal cannot be met.** At step 7 no plan reaches the target graduation term without breaking a rule. The planner builds the plan with the earliest estimated graduation term it can. At step 8 the system shows that term and names the rules that make the target impossible, for example a prerequisite chain that is too long or a course offered only in one kind of term. The student can save it or change the goal (step 6).

**A6. A course to avoid is compulsory.** At step 7 a course to avoid is a compulsory course. The planner places it anyway and, at step 8, explains that every student of the cohort must pass it.

**A7. No transcript yet.** At step 2 the student has no saved transcript. The system warns that the plan assumes no course has been passed and offers to import one first (UC-02). The student can go on.

**A8. Planning takes too long.** At step 7 the planner has not finished within 30 seconds (Performance NFR). The student can cancel at any time while progress shows. What the planner does at the limit is decided in its ADR (see Open).

**A9. Discard.** At step 8 the student leaves without saving. No plan is stored.

**A10. Edit after saving.** After step 10 the student opens the saved plan in the planner (UC-05) or tries a what-if scenario (UC-06) on it.

## 6. Postconditions

- **Success:** a new plan is saved for the student, and the plan breaks no academic rule at the time it was generated.
- **Discard or failure:** no plan is stored. The student's other plans are unchanged.
- In both cases each call to the model leaves one usage record (user, feature, model, tokens, time taken) with none of the text sent or received (ADR 0003).

## 7. Special requirements

- **Academic rules** (AGENTS.md hard rule 1): every placement and every reason shown come from the planner and the rule engine. The model fills form fields only, and the student sees its output before it has any effect.
- **Privacy** (AGENTS.md hard rule 3, ADR 0003): only the sentence and the curriculum's course codes and names go to the model. The student's name, email, student ID and transcript do not, and prompt and reply content is never logged. The provider does not train on prompts (OpenRouter account setting).
- **Performance** (Vision §6): a plan returns within 30 seconds, with visible progress.
- **Robustness:** with the model down, the student can still plan from the form (A1, A2).
- **Usability:** the fields the goal box changed are marked in words as well as by colour, so a misread sentence is easy to spot.

## 8. Additional information

- **Depends on:** Triết's rule engine as callable functions (due 29 Nov), and Hoà's plans API (due 8 Nov). The goal box uses the AI gateway (#12).
- **Extension points:** UC-05 (edit the generated plan), UC-06 (what-if scenario on it).
- **Open**, for the planner's ADR (Lâm, `plan-generator` module, before Sprint 5):
  - the search method;
  - what happens at the 30-second limit (A8): stop and suggest relaxing the goal, or return the best rule-abiding plan found so far;
  - whether the model also writes a plain-language summary of the result from the planner's reasons, which ADR 0003 allows. The summary could never change a placement.
