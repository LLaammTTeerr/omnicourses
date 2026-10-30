# UC-08: Ask the advisor chat

- Feature: F8 AI academic advisor chat (Vision §5, kept by [ADR 0003](../../analysis-and-design/adr/0003-language-model-scope.md))
- Owner: Dũng
- Status: draft for the use-case model (PA2); describes work still to be built (Sprint 5, build B3)
- Built so far: the AI gateway's `chat()` with tools, streaming and the per-user daily cap (PR #12). The `advisor` module, its prompt, tools and screen are not built.
- Naming: "advisor chat" is the F8 feature. In the glossary an **advisor** is a lecturer who reads a shared plan (UC-09), so this use case does not call the chatbot "the advisor".

## 1. Brief description

A student asks a question about their studies in their own words, for example "Can I take Machine Learning before Probability and Statistics?" or "How many credits can I register for next term?". The advisor chat answers from the official curriculum and regulations. Anything about the student's own record is checked by the rule engine. Each answer cites the document and clause it relies on, so the student can check it.

## 2. Actors

- **Student** (primary).
- **Model provider** (secondary): an AI model reached through OmniCourse's AI gateway. It receives the conversation, the regulation clauses and curriculum data the tools return, and, after consent, the student's pseudonymous record: program, cohort, course codes, grades and terms. It never receives the student's name, email or student ID (ADR 0003).

## 3. Preconditions

- The student is signed in (UC-01).
- The regulation documents the advisor chat answers from are loaded (section 8).

Onboarding and a saved transcript are not required. Without them the advisor chat answers in general terms only (A8).

## 4. Basic flow

1. The student opens **Advisor chat**.
2. On first use only, the system explains what is sent to the AI provider: program, cohort, course codes, grades and terms, never the student's name, email or student ID. It says the provider does not train on it and the conversation's content is not logged. The student presses **I agree**, and the system records the time of consent. The other choice is **Not now** (A1).
3. The system shows an empty conversation with a few example questions. A note under the text box says that answers can be wrong, that the cited clause is the authority, and that names and student IDs should be left out.
4. The student types a question and presses **Send**.
5. The system sends the question, the earlier messages of this conversation and the advisor chat's tools to the model through the gateway.
6. The model calls the tools it needs, within the gateway's step limit (5 model turns, ADR 0003). It can search the regulations, look up a course in the student's curriculum, read the student's record, ask the rule engine to check a rule, and find a guide. While a tool runs, the system says what it is doing, for example "Checking prerequisites…".
7. The system shows the answer as it is written, word by word.
8. When the answer is complete, the system shows each cited document and clause as a link. Opening one shows the clause's text. A statement about the student's own record shows the rule engine result it came from, for example "CS162 is a prerequisite of CS163; your transcript shows CS162 passed in term 1 of 2025–2026".
9. The student reads the answer, then asks a follow-up question (step 4) or leaves.

## 5. Alternative flows

**A1. Consent declined.** At step 2 the student presses **Not now**. The conversation opens in general mode: it answers questions about the regulations only. The student's record, program and cohort are never sent, and the model gets only the `search_regulations` and `find_guide` tools. A question about the student's own record gets a reply that it needs consent, with a button to give it. The rest of OmniCourse works as before.

**A2. AI unavailable.** At step 5 the gateway answers `ai_unavailable`: no provider configured, the provider unreachable or timed out, or the monthly budget spent (ADR 0003). The system says the advisor chat is unavailable right now and keeps the question in the text box so the student can send it later. It points to the guides (UC-10) and the curriculum explorer (UC-04). Nothing else in OmniCourse is affected (Robustness NFR).

**A3. Failure in the middle of an answer.** At step 7 the provider fails after the answer has started. The gateway ends the stream with an `error` event (PR #12). The system keeps the text received so far, marks it **Incomplete**, and offers **Ask again**.

**A4. Daily AI limit reached.** At step 5 the student has used their daily number of AI calls (default 20, shared with the goal box of UC-07). The system says the advisor chat works again within 24 hours, as older calls leave the rolling window. One question is one call, however many tools it uses.

**A5. Student stops the answer.** At step 7 the student presses **Stop**. The system stops the answer and marks it **Stopped**. The call still counts toward the daily limit, because it already reached the model (ADR 0003).

**A6. No source found.** At step 6 the regulation search and the curriculum return nothing that answers the question. The advisor chat says it found no document that answers it, and does not guess. It suggests where to ask, such as the academic office, and links a guide (UC-10) if one matches.

**A7. The rule engine cannot decide.** At step 6 the question needs a rule the rule engine does not encode, or data it does not have yet, such as a course's offering terms. The advisor chat says it cannot confirm the answer for this student. It shows the clause that states the rule if the search found one, and suggests confirming with the academic office. The model never decides the rule itself (AGENTS.md hard rule 1).

**A8. No program or no transcript.** At step 6 the student has not finished onboarding (UC-01) or has no saved transcript (UC-02). The advisor chat answers from the regulations only and says the answer is not checked against the student's own record. It offers to finish onboarding or import a transcript.

**A9. Question about a school task.** At step 6 the question is how to do something on a portal, for example "How do I pay tuition?". The advisor chat finds the guide and links it (UC-10) instead of writing its own steps, because guides are checked against the portal and versioned.

**A10. Request to act.** The student asks the advisor chat to change a plan, edit the transcript or register for a course. The advisor chat has no tool that changes anything. It explains what the student can do and links the planner (UC-05), the transcript (UC-02) or the course registration guide (UC-10). OmniCourse never registers for a student (AGENTS.md hard rule 2).

**A11. Question outside studies.** The question is not about the curriculum, the regulations, the student's record or a school task. The advisor chat says what it can help with and does not answer.

**A12. Consent withdrawn.** In account settings the student withdraws consent. The system stops sending the record at once, and the advisor chat continues in general mode (A1).

## 6. Postconditions

- **Success:** the student has an answer with its sources shown. The advisor chat changed nothing in the student's transcript, plans or account.
- **Failure:** the student has no answer, or a partial one marked **Incomplete** or **Stopped**. Nothing else changed.
- In both cases each call that reached the model leaves one usage record (user, feature `advisor`, model, tokens, time taken) with none of the text sent or received (ADR 0003). The consent time stays stored until withdrawn.

## 7. Special requirements

- **Academic rules** (AGENTS.md hard rule 1, ADR 0003): every statement about an academic rule as it applies to the student, such as a prerequisite, an offering term, the credit cap, requirement coverage or graduation status, comes from a rule engine call made for that answer, and the answer shows that result. The model explains results; it never produces them.
- **Citations** (Usability NFR: "every AI answer links to the document and clause it relies on"): an answer that states a rule cites its document and clause. The links are built from the clauses the regulation search actually returned, so a link never points to a clause that does not exist.
- **Privacy** (AGENTS.md hard rule 3, ADR 0003): only the pseudonymous record is sent, and only after consent. Prompt and reply content is never logged; neither are tool arguments, which can hold the record (`llm.service.ts`). The provider does not train on prompts (OpenRouter account setting). Tests use `FakeLlmService` and synthetic records; CI never calls the provider.
- **Performance:** the first words appear in about a second (ADR 0003). Each request to the provider times out after 30 seconds.
- **Robustness:** when the model is down, only the advisor chat and the goal box are unavailable (A2).
- **Usability:** Vietnamese and English; the answer is in the language of the question. Works from 360 px wide and by keyboard. The streamed answer is announced to screen readers without interrupting them, and citation links are reachable by keyboard.

## 8. Additional information

**Depends on:**
- the AI gateway's `chat()` (PR #12, merged);
- Triết's rule engine as callable functions (due 29 Nov) and the curriculum read API;
- the student record ([ADR 0007](../../analysis-and-design/adr/0007-transcript.md), PR #29);
- guides (UC-10) for the guide lookup;
- the regulation files and their clauses (below).

**Tools the model may call.** Dũng writes the handlers in the `advisor` module (ADR 0003). Names are proposals.

| Tool | Returns | Source |
| --- | --- | --- |
| `search_regulations` | Clauses: document, clause number, text, link | Regulation files (below) |
| `get_my_record` | Program, cohort, course codes, grades, terms | Student record (ADR 0007) |
| `lookup_course` | Code, name, credits, prerequisites, offering terms, requirement groups | Curriculum read API |
| `check_rule` | The rule engine's result and the rule it applied, for example "may take CS163 in term 2" | `RulesService` (Triết) |
| `find_guide` | Guide title, link and version | Guides (UC-10) |

None of the tools writes anything. In general mode (A1) only `search_regulations` and `find_guide` are offered.

**Decided** (Lâm, 30 Oct 2026):
- Conversations are not stored on the server. A conversation lives in the open page only, and leaving or reloading the page starts a new one. This avoids storing free text that may hold personal data.
- A student who declines consent can still use the advisor chat for general questions about the regulations, and their record is never sent (A1).
- Dũng types the regulation documents in as files in the repository, inside the `advisor` module. Each one goes through a pull request, and Triết or Thắng checks it against the official document. No AI types or drafts them (AGENTS.md hard rule 1, ADR 0003). Guides use the same approach (ADR 0010).

**Proposed here, to confirm:** citation links are built only from clauses returned by `search_regulations`.

**Open:** how clauses are found (PostgreSQL full-text search or embeddings) is Dũng's separate design (ADR 0003, Consequences).
