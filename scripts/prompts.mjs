/**
 * Design-reference prompt library for FinLeaf.
 *
 * Each entry pairs a stable output filename with the image-generation prompt.
 * The shared `BASE` block encodes the visual language from
 * design/design-system.md so every reference describes one coherent product.
 *
 * `page` prompts produce desktop 1440x900 references; entries in `mobile`
 * produce 390x844 references.
 */

export const BASE = `Design a single desktop web application screen for "FinLeaf", a digital banking web app for financial inclusion and low-carbon spending, aimed at first-time and underbanked users in India who may have low literacy and are often on a budget phone. Render it as a clean, flat, professional UI mockup screenshot.

Application frame, keep identical across every screen unless the page is a public landing page:
- Left sidebar, white with a hairline right border: the FinLeaf wordmark with a green leaf mark at the top, then exactly these nine navigation items in this order: Home, Accounts, Send money, Transactions, Pay bills, Save, Loans, Sustainability, Learn. Each item is a simple flat icon plus its text label. The one item for the current page is highlighted with a soft green #e6f2ec rounded background and deep green #12694a text; every other item is plain near-black text. At the bottom of the sidebar, a small circular avatar with the name "Ravi Kumar" and a muted "View profile" link.
- NO top search bar, NO top navigation bar, and no user menu in the top right corner. This app has no global search.
- The main content area sits to the right of the sidebar, on the warm off-white background, and begins with a page heading.

Visual language, follow exactly:
- Warm off-white page background #f7f7f4, white cards #ffffff.
- Primary deep green #12694a for primary buttons and active navigation; soft green tint #e6f2ec for selected chips and rows.
- Text near-black #1a1c19, secondary text #5c615a.
- Hairline borders #e2e2dc. Card radius 12-16px. Cards have NO drop shadow.
- One muted accent blue #1f5fa8 reserved for a "trust score" concept, and one amber #9a5b00 reserved for warnings or pending states. Never use gradients, never use glassmorphism, never use purple or neon.
- System sans-serif typeface, near-black text. Numbers large, bold, and tabular-aligned.
- Generous whitespace, clear hierarchy, restrained colour, no clutter.
- Icons are simple flat line/solid glyphs in a circle, always paired with a visible text label. Never rely on colour alone to convey meaning.
- All text must be legible, realistic, and correctly spelled English UI copy. Include realistic Indian rupee amounts such as 12,450.

Output a straight-on full-page screenshot of the screen at 1440x900 desktop viewport, filling the frame edge to edge. Do not add a device mockup, browser chrome, hand holding the phone, desk scene, or any surrounding context: just the application screen itself. Do not add explanatory captions or callout annotations outside the UI.`;

export const MOBILE_SUFFIX = `

Render this same screen as a MOBILE view at 390x844: single column, 16px gutters, a bottom tab bar instead of a sidebar, stacked cards, and the primary number near the top. Just the app screen filling the frame, no device mockup.`;

const withBase = (body) => `${BASE}\n\n${body}`;

/**
 * Reference prompts, keyed by output filename.
 * Kept as a flat object so the caller can iterate deterministically.
 */
export const PAGES = {
  // --- Public / auth -----------------------------------------------------
  "landing": withBase(`This is the public landing page for FinLeaf. Show a top navigation bar with the FinLeaf wordmark on the left and links "How it works", "Features", "Sign in", plus a green "Open an account" button on the right. Below it a centered hero section: a large bold headline "Banking that reaches everyone, and that's good for the planet", one short supporting paragraph, and two buttons side by side (solid green "Open an account" and outlined "Sign in"). Under the hero, a row of three equal white cards each with a circular flat icon, a short bold title and two lines of text: "Trust score, not paperwork" explaining an alternative credit score from everyday app behaviour, "Your spending's carbon, counted" explaining category-based footprint estimates, and "Speak, don't type" explaining voice guidance in your language. Then a wide section titled "How it works" with three numbered steps connected in a row: "1 Open an account in minutes", "2 Save, transfer and pay bills", "3 Build your trust score and unlock a micro-loan". Then a slim muted band explaining this is a simulated prototype for demonstration with no real bank connection. Footer with small links.`),

  "login": withBase(`This is the FinLeaf sign-in page. Show a centered narrow white card on the warm off-white background. At the top of the card a large flat illustration of a simple leaf and a small bank building, then the bold heading "Welcome back" and a muted line "Sign in to your FinLeaf account". Below: a phone number input field with the visible label "Phone number" above it, a six-box one-time-password input row with the label "One-time password", and a muted helper line "Demo code is 123456". Then a full-width solid green button "Sign in". Below the button, a text link row "Forgot password?" aligned right. At the very bottom of the card, a muted line "New to FinLeaf? Create an account" with "Create an account" as a green link. Do not show a social login button.`),

  "signup": withBase(`This is the FinLeaf registration page, step 1 of 3. Show a centered narrow white card. At top a small progress indicator "Step 1 of 3" with a short green progress bar. Bold heading "Create your account" and muted line "It takes about two minutes. Only three details needed." Below, three stacked input fields each with a visible label above it: "Full name" pre-filled with "Ravi Kumar", "Phone number" pre-filled with "+91 98765 43210", and a dropdown "Primary language" showing "English". Then a full-width solid green button "Continue". Below the button a small muted note with a padlock icon reading "We never ask for a bank account number, card details, or a government ID number."`),

  "onboarding": withBase(`This is the FinLeaf voice-guided onboarding screen. Show a centered narrow white card. At top a small step indicator "Step 2 of 3". Bold heading "You're nearly done" and muted line "Just confirm these details". The card body shows three read-only summary rows separated by hairlines, each with a small icon, a grey label and a bold value: a person icon with "Name" and "Ravi Kumar", a phone icon with "Phone" and "+91 98765 43210", and a globe icon with "Language" and "English". Then a prominent rounded rectangular voice panel with a soft green background showing a large circular microphone icon in the centre, the text "Speak to continue" and a muted line "Try saying: set up my account". Beneath it, a full-width solid green button "Continue without voice".`),

  // --- Banking -----------------------------------------------------------
  "dashboard": withBase(`This is the main FinLeaf account dashboard, the most important screen. In the sidebar, "Home" is the active item.

The main area on the right: at the top a page header with the bold heading "Good morning, Ravi" and a muted line "Monday, 5 October" with a small notification bell icon at the far right carrying a small green dot.

Below the header, a row of three stat cards. The first and largest white card reads "Total balance" with a muted "Estimated" label, and beneath it a very large bold tabular number "12,450.00", with a small muted line "across 2 accounts". The second card has a circular gauge labelled "Trust score" showing the number 68 inside it with a blue accent arc and a small band label "Steady". The third card has a circular gauge labelled "Sustainability score" showing the number 54 inside it with a green accent arc and a small line "This month 24.8 kg CO2e".

Then a wide white card titled "Quick actions" containing four equal action tiles in a row, each with a circular flat icon above a bold label: "Send money", "Pay a bill", "Add savings", "Recharge".

Then two columns side by side: on the left a taller white card titled "Recent transactions" with a "See all" link at its top right, listing four transaction rows. Each row has a circular category icon tile on the left, a bold merchant name, a muted second line, and a right-aligned tabular rupee amount where debits have a minus sign: "Village Market" with "Groceries - today" and "-840.00"; "Bus pass recharge" with "Travel - today" and "-250.00"; "Salary credit" with "Transfer - yesterday" and "+15,000.00" shown in green; "Electricity bill" with "Bills - 2 days ago" and "-1,180.00". On the right, a white card titled "This month" with a simple bar chart of monthly estimated carbon emissions labelled "Estimated kg CO2e" showing five months from May to September with a green bar highlighted for the current month and a caption "Down 12% versus last month".`),

  "transfer": withBase(`This is the FinLeaf "Send money" screen. In the sidebar, "Send money" is the active item. Main area: page header with bold heading "Send money" and a muted line "Transferring to another FinLeaf account is instant and free."

Below, a wide white form card. First field: label "Send to" above a search input with placeholder "Search by name or phone number", and beneath it two suggested recipient rows each with a circular avatar, a bold name and a muted phone number: "Sunita Devi" "+91 98111 22334" and "Anil Traders" "+91 97654 33221". Second field: label "Amount" above a large amount input showing "1,500.00" with a small muted "Available balance 12,450.00" aligned right. Third field: label "Add a note (optional)" above a text input showing "Rent contribution". Then a muted inline notice strip with a small info icon reading "This is a simulated transfer. No real money moves." Beneath the fields, a full-width solid green button "Review transfer" and next to it an outlined button "Cancel".

To the right of the form card, a narrower white card titled "Recent recipients" with a "See all" link, listing four recipient rows with avatar, name, and the last amount sent: "Sunita Devi -1,200.00", "Anil Traders -3,400.00", "Meena Kitchen -450.00", "Ravi Kumar -800.00".`),

  "transaction-history": withBase(`This is the FinLeaf transaction history screen. In the sidebar, "Transactions" is the active item. Main area: page header with bold heading "Transactions" and muted line "Every movement in your account, newest first".

Below the header, a white filter card containing a filter row. On the left a search input with placeholder "Search merchant or note". Then three labelled filter controls in a row: a dropdown "All categories" showing "All categories", a dropdown "All dates" showing "All dates", and a dropdown "Any amount" showing "Any amount". On the far right a muted result count "84 transactions".

Below the filter card, a wide white table card listing transactions. It has a table header row in small uppercase grey text with columns: "Merchant", "Category", "Date", "Amount". Below are eight transaction rows separated by hairlines, each row with a circular category icon tile, a bold merchant name, a muted category with a small tag pill, a grey date, and a right-aligned tabular amount where debits are prefixed with a minus and the one credit is green: "Village Market" "Groceries" "5 Oct" "-840.00"; "Bus pass recharge" "Travel" "5 Oct" "-250.00"; "Salary credit" "Transfer" "4 Oct" "+15,000.00"; "Electricity bill" "Bills" "3 Oct" "-1,180.00"; "Paddy and vegetables" "Groceries" "2 Oct" "-610.00"; "Diesel" "Fuel" "1 Oct" "-2,000.00"; "Mobile recharge" "Recharge" "30 Sep" "-299.00"; "Clinic" "Health" "28 Sep" "-450.00".`),

  "bill-payments": withBase(`This is the FinLeaf bill payments and recharge screen. In the sidebar, "Pay bills" is the active item. Main area: page header with bold heading "Pay a bill or recharge" and muted line "Choose a biller, enter the amount, and confirm."

Below the header, a row of six category tiles in a single row, each a white rounded card with a circular flat icon and a bold label beneath: "Electricity", "Water", "Mobile", "DTH", "Gas", "Bus pass". One tile, "Electricity", is selected and shown with a soft green background and a deep green icon.

Below that, a wide white form card with fields: a dropdown "Biller" showing "Uttar Pradesh Power Corp", an input "Consumer number" showing "8845120397", an input "Amount" showing "1,180.00", and a dropdown "Pay from" showing "Main wallet". A muted note reads "Simulated payment for demonstration only." Then a full-width solid green button "Pay 1,180.00".

To the right, a white card titled "Upcoming bills" listing three rows, each with a bold biller name, a muted due label, and a right-aligned tabular amount: "Electricity due in 2 days 1,180.00", "Mobile recharge due in 5 days 299.00", "Water bill due in 9 days 640.00".`),

  // --- Inclusion ---------------------------------------------------------
  "trust-score": withBase(`This is the FinLeaf trust score screen. In the sidebar, "Loans" is the active item. Main area: page header with bold heading "Your trust score" and a muted line "Built from how you use your account, not from paperwork".

Below the header, a wide white card split into two halves. On the left a large circular gauge in muted accent blue #1f5fa8 showing the number 68 in large bold text in the centre, with a band label "Steady" beneath it, and a muted line "Top 40% of FinLeaf users". On the right a vertical bar chart titled "What moves your score" with five horizontal bars in blue, each with a bold signed point value and a label: "Regular savings +18", "On-time bill payments +15", "Consistent activity +12", "Account age +9", "Family group activity +5". Under the chart a muted caption "These points come from the model that calculated your score."

Below that, a row of two white cards. On the left a card titled "Improve your score" with three checklist rows, each with a small circular icon, a bold action and a muted points value: "Set up one savings goal +10", "Pay a bill on time +8", "Use your account weekly +5". On the right a card titled "What we never use" with three rows of muted text with small lock icons: "Gender", "Caste or religion", "Aadhaar or PAN details", under a muted line "These are excluded from scoring by design."`),

  "loan-application": withBase(`This is the FinLeaf micro-loan screen. In the sidebar, "Loans" is the active item. Main area: page header with bold heading "Micro-loans" and a muted line "Small loans decided by your trust score".

Below the header, a wide white card split into two columns. On the left a bold label "You're eligible for" above a very large tabular number "25,000" with a muted line "Maximum amount based on trust score 68". Below it a solid green button "Apply for 25,000" and a muted line "Repayment over 6 monthly instalments of 4,167." On the right a small muted info card titled "How the amount is worked out" with three short rows: "Trust score 68 of 100", "Repayment history Good", "Savings record Improving", and a muted line "This is an estimate, not a credit approval."

Below that, a white card titled "Your applications" listing two past applications with status pills. The first row shows "Applied 2 Oct", a loan name "Group loan - Festival advance", an amount "8,000", and an amber pill "In review". The second row shows "Settled 12 Aug", "Group loan - Seeds", "5,000", and a green pill "Repaid".`),

  "savings-goals": withBase(`This is the FinLeaf micro-savings goals screen. In the sidebar, "Save" is the active item. Main area: page header with bold heading "Savings goals" and muted line "Small steps, clearly tracked".

Below the header, a row of two white goal cards. Each card has a bold goal name, a muted target line, a horizontal progress bar in green with a soft green track, a tabular percentage, and a bold saved-versus-target amount. The first card: "School fees for Meena", progress 68 percent, "6,800 of 10,000", with a muted line "26 weeks left at 260 per week" and a small solid green button "Add 260". The second card: "New bicycle", progress 34 percent, "1,020 of 3,000", muted "Auto-saves 100 every Friday", with an outlined button "Pause".

Below that, a full-width solid green button "Create a new goal" and beside it an outlined button "See all goals". At the bottom, a white card titled "Weekly habit" showing a small row of seven circular day markers, four of them filled green to show four deposits made this month, with a muted caption "You have saved every week for 4 weeks."`),

  "financial-literacy": withBase(`This is the FinLeaf financial literacy section. In the sidebar, "Learn" is the active item. Main area: page header with bold heading "Money lessons" and a muted line "Short reads in your language, with a quiz at the end".

Below the header, a row of three lesson cards. Each card has a small rounded thumbnail image in flat green illustration style, a bold lesson title, a muted duration line such as "4 min read", a small progress state, and a bold action link. The first: "How to keep your savings safe", "4 min read", "Not started", "Start lesson". The second: "Why paying bills on time matters", "6 min read", "Quiz passed", shown with a small green check. The third: "Understanding your trust score", "5 min read", "In progress 40%", "Continue".

Below that, a wide white card titled "Your badges" showing a row of six circular badge icons. Three are earned and shown in full colour with a label beneath: "First transfer", "Goal crusher", "On-time payer". Three are locked and shown in muted grey with a small padlock and a label: "Quiz whiz", "Green shopper", "Carbon cutter". Beneath the row a muted line "3 of 6 badges earned."`),

  "family-accounts": withBase(`This is the FinLeaf family group account screen. In the sidebar, "Accounts" is the active item. Main area: page header with bold heading "Family account" and muted line "Kumar household - 4 members with shared visibility".

Below the header, a wide white card showing the group balance: a muted label "Group balance" above a large tabular number "31,200.00", with three small member avatar tiles and names to the right: "Ravi", "Sunita", "Meena", plus a "+1" tile.

Below, a white card titled "Recent group activity" with a table of four rows: columns "Member", "Activity", "Amount". Rows: "Sunita Devi" "Added to group savings" "+2,000.00" in green; "Meena Kumar" "Group grocery purchase" "-1,450.00"; "Ravi Kumar" "Sent to Sunita Devi" "-1,200.00"; "Sunita Devi" "Bus pass for Meena" "-250.00".

To the right, a narrower white card titled "Members" listing four member rows each with a circular avatar, a bold name, a muted role label, and a right-aligned small muted visibility label: "Ravi Kumar" "Owner" "Full access"; "Sunita Devi" "Member" "Can pay bills"; "Meena Kumar" "Member" "View only"; "Sharma Uncle" "Member" "View only". Below it an outlined button "Invite a member".`),

  "trust-circles": withBase(`This is the FinLeaf community trust circles screen. In the sidebar, "Learn" is the active item. Main area: page header with bold heading "Your trust circle" and muted line "Small peer groups that vouch for each other, like a savings group".

Below the header, a wide white card for the user's own circle titled "Kudumb_circle_04". It shows a muted line "6 members - Dharwad district", a row of six circular member avatars with first names beneath them, and three summary figures in a row: "Avg circle trust score 61", "Endorsements received 4", "Group savings 18,400".

Below that, a white card titled "Endorsements" listing three rows. Each row has a circular avatar, the endorser's bold name, a one-line bold endorsement reason, a muted date, and a right-aligned green pill reading "+6 points". Rows: "Sunita Devi" "Pays her group share on time, every month" "2 days ago"; "Anil Traders" "Lent to two members and both repaid" "1 week ago"; "Meena Kumar" "Never missed a savings week" "2 weeks ago".

At the bottom a full-width solid green button "Endorse a member" and a muted line explaining "Endorsements adjust your trust score within limits and can be withdrawn by the member."`),

  "agent-locator": withBase(`This is the FinLeaf nearby banking agent locator. In the sidebar, "Accounts" is the active item. Main area: page header with bold heading "Nearby agents and kiosks" and muted line "Cash deposit and withdrawal points near you".

Below the header, a row of two columns. On the left a white card roughly two thirds width containing a simple flat illustrated map of a small Indian town, showing pale beige land, a few grey roads, a green park block, and five circular green markers with small rupee or cash symbols at varied positions, plus a small zoom control with plus and minus buttons in the corner. On the right a white card titled "4 places near you" listing four rows, each with a circular icon, a bold place name, a muted distance such as "0.4 km - open until 6 pm", and a small outlined button labelled "Directions". Rows: "Kirana Store - Shantivan", "FinLeaf Kiosk - Bus Stand", "Common Service Centre - Main Road", "Bank Mitra - Railway Station".

Below the map card, a muted inline note with a small info icon: "Agent locations are simulated for this prototype."`),

  "voice-assistant": withBase(`This is the FinLeaf voice assistant screen. In the sidebar, "Learn" is the active item. Main area: page header with bold heading "Voice assistant" and muted line "Ask about your money by speaking".

Below the header, a large centred white card. At its top a big circular microphone button with a soft green background, roughly 120px across, with a bold label beneath reading "Tap to speak" and a muted line "Works in English, Hindi, and Kannada". Below that, a transcript panel with a soft grey background showing three example exchanges with a small speaker icon and the spoken text, plus the plain-language reply. Entries: spoken "check my balance", reply "Your balance is 12,450 rupees"; spoken "how much did I spend on fuel", reply "You spent 2,000 rupees on fuel this month, about 50 kg CO2e estimated"; spoken "pay my electricity bill", reply "Opening your electricity bill of 1,180 rupees".

Below the transcript a row of three suggestion chips with rounded pill borders reading "Check balance", "My trust score", "My carbon total". At the bottom of the card a muted line with a small info icon: "If your browser does not support speech, you can type your question instead" above a plain text input row with a green send button.`),

  "chatbot": withBase(`This is the FinLeaf financial literacy chatbot screen. In the sidebar, "Learn" is the active item. Main area: page header with bold heading "Ask FinLeaf" and muted line "Plain-language answers about saving, borrowing, and avoiding fraud".

Below the header, a white chat card roughly 560px tall. Inside, a scrolling conversation with alternating message bubbles. Left bubbles in a soft grey #f0f0ec with near-black text are the user's; right bubbles in soft green #e6f2ec with deep green text are FinLeaf's. Each bubble has a bold title line and two or three lines of plain text. Messages: user "What is a trust score?"; FinLeaf "It is a 0 to 100 score built from how you use your account, such as saving regularly and paying bills on time."; user "How do I raise mine?"; FinLeaf "Set up a savings goal, pay one bill on time, and use your account each week. Your score updates automatically."; user "Is my money safe?"; FinLeaf "This is a simulated prototype, so no real money moves. In a live product, deposits would be insured by DICGC." Below the last FinLeaf bubble, a small muted caption reading "Answers are general guidance, not financial advice."

At the bottom of the card, a row of three quick-question chips reading "How to save faster", "What is a micro-loan", "How to avoid fraud", above a text input with placeholder "Ask a question" and a green circular send button.`),

  // --- Sustainability -----------------------------------------------------
  "sustainability-dashboard": withBase(`This is the FinLeaf sustainability dashboard. In the sidebar, "Sustainability" is the active item. Main area: page header with bold heading "Your carbon footprint" and muted line "Estimated from what you spend, in kilograms of CO2e".

Below the header, a row of three stat cards. First: muted label "This month" with a large tabular number "24.8" and unit "kg CO2e", plus a small muted line "Estimated". Second: circular gauge labelled "Sustainability score" showing 54 with a green arc and band label "Fair". Third: a card labelled "Green points" showing a large number "1,240" with a muted line "460 redeemed" and a small green leaf icon.

Below, a wide white card titled "Estimated emissions by category" containing a horizontal bar chart with six bars, each labelled with its category, its tabular kg CO2e value, and a muted kg share. Bars: "Fuel 10.0 kg" the longest and in a deeper green; "Travel 5.2 kg"; "Groceries 4.1 kg"; "Dining 2.8 kg"; "Electronics 1.7 kg"; "Bills 1.0 kg". Beneath the chart a muted caption "Estimates use fixed category factors. They are not a precise measurement."

Below that, two columns: on the left a white card titled "Monthly trend" with a line chart showing six months of estimated kg CO2e with a downward trend, the last point labelled, and y-axis labels; on the right a white card titled "Paperless savings" with a large tabular number "146" and unit "sheets of paper", a muted line "By choosing digital receipts and e-bills", and a small green leaf icon.`),

  "carbon-details": withBase(`This is the FinLeaf transaction-level carbon detail screen. In the sidebar, "Sustainability" is the active item. Main area: page header with bold heading "Why this estimate?" and muted line "How a single transaction turns into kilograms of CO2e".

Below the header, a wide white explanation card with a worked example. At the top a bold line "Worked example - fuel purchase". Then a small three-step vertical flow separated by hairlines. Step one: a row with a bold "1. Amount spent" and a tabular value "2,000.00" labelled "rupees". Step two: a bold "2. Category factor" with a tabular value "2.5" and a muted unit "kg CO2 per 100 rupees spent". Step three: a bold "3. Estimated footprint" with a large tabular green number "50.0 kg CO2e". Beneath the flow, a muted note reading "These are category averages. Real emissions depend on the exact fuel, distance travelled, and energy source, which this prototype cannot measure."

Below that, a wide white table card titled "Per-transaction estimates" with a header row in small uppercase grey text: "Merchant", "Category", "Amount", "Factor", "Estimated CO2e". Below are six rows with hairline separators, right-aligned tabular numbers: "Diesel" "Fuel" "2,000.00" "2.5 / 100" "50.0 kg"; "Bus pass" "Travel" "250.00" "0.4 / 100" "1.0 kg"; "Village Market" "Groceries" "840.00" "0.5 / 100" "4.2 kg"; "Restaurant" "Dining" "600.00" "0.5 / 100" "3.0 kg"; "Electricity bill" "Bills" "1,180.00" "0.4 / 100" "4.7 kg"; "Headphones" "Electronics" "1,500.00" "3.2 / 100" "48.0 kg".`),

  "green-rewards": withBase(`This is the FinLeaf green rewards page. In the sidebar, "Sustainability" is the active item. Main area: page header with bold heading "Green rewards" and muted line "Spend lower-carbon, earn green points".

Below the header, a wide white card with a muted label "Your green points balance" above a very large tabular number "1,240" and a muted line "Next reward at 1,500 points". Beneath it a thin progress bar with a soft green track and a deep green fill.

Below, a grid of four reward cards in two rows of two. Each card has a small flat icon, a bold reward title, a muted description of the qualifying action, a bold point cost in green, and an outlined "Redeem" button. Cards: "Bus pass discount" "Ride the bus twice this month" "200 points"; "Recharge at a local vendor" "Recharge your phone locally" "150 points"; "Tree sapling sponsored" "Plant one tree with us" "600 points"; "Clean cookstove contribution" "Fund a cleaner stove" "800 points". One card, "Recharge at a local vendor", is shown in a lighter disabled state with a muted button reading "150 points to go".`),

  "carbon-offsets": withBase(`This is the FinLeaf carbon offset marketplace. In the sidebar, "Sustainability" is the active item. Main area: page header with bold heading "Carbon offset projects" and muted line "Spend green points to fund verified local projects".

Below the header, a row of three project cards. Each card has a small flat illustration thumbnail in the top area, a bold project title, a muted location line, two small stat rows showing "Trees planted" or "Cookstoves funded" with a tabular count, a muted impact line such as "About 12 kg CO2e offset per 600 points", a bold green point cost, and a solid green "Fund with points" button. Cards: "Trees for Doddawadi" "Dharwad district - 1,200 trees planted" "600 points"; "Cleaner cookstoves" "Rural Karnataka - 310 cookstoves funded" "800 points"; "Mangrove restoration" "Coastal Karnataka - 4,500 saplings" "1,100 points".

Below, a white card titled "Your total impact" showing three figures in a row: a tabular "18,400" labelled "points spent", a tabular "1,510" labelled "kg CO2e offset", and a tabular "1,200" labelled "trees supported", with a muted line "Estimates are illustrative."`),

  "leaderboard": withBase(`This is the FinLeaf peer comparison leaderboard. In the sidebar, "Sustainability" is the active item. Main area: page header with bold heading "Your village comparison" and muted line "How your spending compares with people near you".

Below the header, a small toggle row with two pills, where "Lower footprint" is selected with a soft green background and deep green text, and the other reads "More green points".

Below, a white table card titled "Dharwad district - October" with a header row in small uppercase grey text: "Rank", "Member", "Estimated CO2e", "Green points". Seven rows separated by hairlines, each with a circular avatar, a bold name, a tabular kg value, and a tabular points value. The user's own row is highlighted with a soft green background and labelled "You". Rows: "1 Meena Kumar" "18.2 kg" "1,980"; "2 Ravi Kumar (You)" "24.8 kg" "1,240" highlighted; "3 Sunita Devi" "26.1 kg" "1,410"; "4 Anil Traders" "31.5 kg" "1,120"; "5 Prakash Patil" "38.9 kg" "860"; "6 Fatima Begum" "44.2 kg" "720"; "7 Ravi Sharma" "52.7 kg" "540".

Below the table, a wide white card titled "Neighbourhood averages" showing three figures in a row with muted comparison bars beneath each: "Your 24.8 kg", "Dharwad average 33.4 kg", "District average 41.2 kg", each with a short muted line such as "26% below your district average".`),

  // --- Security / settings ------------------------------------------------
  "fraud-alerts": withBase(`This is the FinLeaf suspicious activity review screen. In the sidebar, "Accounts" is the active item. Main area: page header with bold heading "Activity to review" and muted line "We noticed something unusual. Only you can confirm it.".

Below the header, a wide white card with an amber #fdf1de tinted left border and a small amber shield icon. Its title reads "Possible unusual activity" in bold. Beneath, the transaction row: a circular icon, bold "Diesel transfer", muted "Fuel - 3 Oct, 11:47 pm", and a right-aligned tabular "-8,500.00". Below that a muted line "Flagged because it is larger than your usual payments and happened at an unusual hour. Your money was not blocked.".

Below that, a row of two buttons side by side: a solid green button "Yes, that was me" and an outlined red-bordered button "No, I did not do this".

Below, a wide white table card titled "Earlier reviews" with a header row in small uppercase grey text: "Transaction", "Date", "Reason", "Outcome". Four rows with hairline separators and right-aligned status pills: "Bus pass recharge" "1 Oct" "Unusual hour" "Confirmed by you" green pill; "Phone recharge 999" "28 Sep" "Unusual amount" "Confirmed by you" green pill; "Transfer to unknown" "20 Sep" "New recipient" "Marked safe" green pill; "ATM withdrawal" "14 Sep" "Unusual location" "Confirmed by you" green pill.`),

  "profile-settings": withBase(`This is the FinLeaf profile and settings screen. In the sidebar, no item is highlighted except a small settings gear icon at the very bottom. Main area: page header with bold heading "Settings" and muted line "Your account, language, and accessibility preferences".

Below the header, a row of two columns. On the left a wide white card titled "Profile" showing a circular avatar, a bold name "Ravi Kumar", a muted phone number "+91 98765 43210", and a green pill "Verified demo account". Below it a bordered list of four setting rows, each with a circular grey icon on the left, a bold label, a muted secondary line, and a right chevron. Rows: "Personal details" "Name, phone, language"; "Language" "Currently English - change to Hindi or Kannada"; "Accessibility" "Larger text, higher contrast, reduce motion"; "Notifications" "Transaction alerts and reminders".

On the right a narrower white card titled "Session" with a bold label "Signed in as Ravi Kumar", a muted line "This is a simulated prototype account", and an outlined red-bordered button "Sign out". Below it a white card titled "Data and privacy" with three muted rows each with a small lock icon: "Passwords are hashed, never stored in plain text", "We never ask for real card or government ID details", "Scoring excludes gender, caste, and religion", under a muted line "FinLeaf is a demonstration project and moves no real money."`),
};

export const MOBILE = {
  "mobile-dashboard": withBase(`This is the FinLeaf account dashboard on a phone. At the top a white app bar with a small FinLeaf wordmark on the left and a notification bell icon on the right. Below it a muted line "Monday, 5 October" and a bold greeting "Good morning, Ravi".

Below, a large white card showing a muted label "Total balance" with a very large tabular number "12,450.00" and a muted line "Estimated - across 2 accounts". Directly beneath, inside the same card, two smaller side-by-side figures separated by a vertical hairline: on the left a blue-accent circular gauge labelled "Trust score" showing 68, on the right a green-accent circular gauge labelled "Sustainability" showing 54.

Below that, a row of two stacked white cards, each a recent transaction row with a circular icon tile, a bold merchant name, a muted category line, and a right-aligned tabular amount: "Village Market" "Groceries" "-840.00"; "Salary credit" "Transfer" "+15,000.00" in green. Below them a muted centred link "See all transactions".

At the very bottom of the screen a fixed white bottom tab bar with a hairline top border showing five icon-and-label tabs evenly spaced: "Home" active in deep green, "Transfer", "Bills", "Goals", "More".${MOBILE_SUFFIX}`),
};