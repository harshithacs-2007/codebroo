import type { Lesson } from "../types.ts";

export const TWO_REMOTE_CONTROLS: Lesson = {
  id: "java-references-two-remotes",
  track: "java",
  title: "The Two Remote Controls",
  subtitle: "Java references, aliasing, and the pass-by-value story people get wrong",
  skills: ["java-fundamentals", "references", "debugging", "code-reading", "code-writing", "explanation"],
  blocks: [
    {
      id: "hook",
      kind: "hook",
      kicker: "Java · References",
      title: "You have two remote controls. One TV.",
      body: [
        "Your friend gets the second remote.",
        "If they press volume up… what happens?",
        "The TV gets louder. Not a second TV. The remotes are names for the same machine.",
        "Java arrays work like that. The variable is the remote. The array object is the TV.",
        "We're going to make that precise — then we'll try to break it.",
      ],
    },
    {
      id: "predict-alias",
      kind: "predict",
      title: "Predict before you run",
      prompt: "What will a[0] be after this program finishes?",
      code: `int[] a = {10, 20, 30};
int[] b = a;
b[0] = 99;`,
      choices: [
        { id: "10", label: "10" },
        { id: "20", label: "20" },
        { id: "99", label: "99" },
      ],
      correctId: "99",
      misconception: {
        "10": "alias-as-copy",
        "20": "logic",
      },
      reveal: [
        "`int[] a = {10, 20, 30}` creates one array object and stores a reference to it in `a`.",
        "`int[] b = a` copies that reference value into `b`. It does not create another array.",
        "`b[0] = 99` mutates the single array. `a[0]` sees the same slot.",
      ],
    },
    {
      id: "layers",
      kind: "layers",
      title: "Nine layers. Same fact.",
      layers: [
        {
          title: "1 · Intuition",
          body: [
            "A variable is a box that holds a value.",
            "For `int n = 7`, the value is 7 itself.",
            "For `int[] a = {10,20,30}`, the value in `a` is not the three numbers. It is a reference: “the array over there.”",
          ],
        },
        {
          title: "2 · Real-world analogy",
          body: [
            "Two remotes, one TV. Two locker keys, one locker. Two URLs, one document.",
            "Pressing a button (mutating an index) changes the shared thing.",
            "Giving someone a second remote is not buying them a second TV.",
            "The analogy stops here. Java does not have infrared. It has reference values.",
          ],
        },
        {
          title: "3 · Actual Java behavior",
          body: [
            "Java has primitive values (`int`, `boolean`, `double`, …) stored directly in the variable.",
            "Java has reference values for objects. Arrays are objects.",
            "`int[] b = a` copies the bits of the reference. After that, `a` and `b` are aliases: two variables, one object.",
            "`int[] b = new int[]{10, 20, 30}` allocates a second object. Same contents at first. Different identity.",
          ],
        },
        {
          title: "4 · Visual model",
          body: [
            "Draw the stack on the left: names `a` and `b`.",
            "Draw the heap on the right: boxes with identity.",
            "Arrows are references. Mutation changes the box, not the arrow — unless you reassign the variable.",
            "Reassignment (`b = somethingElse`) moves the arrow. Index assignment (`b[0] = 99`) edits the box.",
          ],
        },
        {
          title: "5 · Edge cases",
          body: [
            "`b = null` does not delete the array. It only clears that one remote. If `a` still points at the array, the TV is still there.",
            "If nothing references an object, it becomes unreachable. The GC may collect it later. You don't free() in Java.",
            "A zero-length array is still an object. `null` is not an object; it is a reference value meaning “no object.”",
            "`b[0]` when `b` is null throws `NullPointerException`. The remote isn't pointing at a TV.",
          ],
        },
        {
          title: "6 · Common misconceptions",
          body: [
            "“b is another array.” Only if you used `new` (or an array initializer on a fresh declaration that allocates).",
            "“Java passes objects by reference.” No. Java passes arguments by value. The value of an object argument is a reference, copied into the parameter.",
            "“== compares array contents.” `==` on references compares identity. Content equality is `Arrays.equals`.",
            "“Changing b reassigns a.” Reassigning `b` does not reassign `a`. Mutating through `b` can still be visible through `a`.",
          ],
        },
        {
          title: "7 · Professional relevance",
          body: [
            "APIs that take arrays or mutable lists can mutate your data unless you copy.",
            "Defensive copies exist because aliasing is real.",
            "Immutable designs (unmodifiable lists, records with copied arrays) exist to stop accidental shared mutation.",
            "When you see a bug “I didn't touch that field,” look for another reference to the same object.",
          ],
        },
        {
          title: "8 · Exam and interview",
          body: [
            "Exam trap: print `a[0]` after `b = a; b[0] = 1;`. They want 1.",
            "Exam trap: `b = new int[]{...}` then mutate `b` — `a` unchanged.",
            "Interview: “Is Java pass-by-reference?” The strong answer is: pass-by-value; references are values; mutation of the referent is visible; rebinding the parameter is not.",
            "Follow-up: swap two integers via a method (can't, primitives copied). Swap two array slots via a method (can, same object).",
          ],
        },
        {
          title: "9 · Unfamiliar application",
          body: [
            "You'll do this with methods, then with lists, then with graphs of objects.",
            "Same rule: identity vs equality, copy of reference vs copy of object.",
            "If you can predict aliasing in a method call you haven't seen before, you actually have the model.",
          ],
        },
      ],
    },
    {
      id: "run-alias",
      kind: "run",
      title: "Run it. Watch the arrows.",
      brief: "This is real javac + a real JVM. The picture is dumped from debugger state, not guessed from your source text.",
      code: `public class Main {
    public static void main(String[] args) {
        int[] a = {10, 20, 30};
        int[] b = a;
        System.out.println("before " + a[0]);
        b[0] = 99;
        System.out.println("a[0]=" + a[0]);
        System.out.println("b[0]=" + b[0]);
        System.out.println("same object? " + (a == b));
    }
}
`,
      goal: "Step or run. Confirm a and b point at one array, then watch index 0 become 99.",
    },
    {
      id: "compare-new",
      kind: "compare",
      title: "Copy the reference vs create another object",
      leftTitle: "Alias",
      leftCode: `int[] a = {10, 20, 30};
int[] b = a;
b[0] = 99;`,
      rightTitle: "Separate allocation",
      rightCode: `int[] a = {10, 20, 30};
int[] b = new int[]{10, 20, 30};
b[0] = 99;`,
      ask: "On the right, how many array objects exist after line 2? After `b[0] = 99`, is `a[0]` still 10?",
    },
    {
      id: "run-separate",
      kind: "run",
      title: "Buy the second TV",
      brief: "Now `new` shows up. Two objects. Mutating b must not change a.",
      code: `public class Main {
    public static void main(String[] args) {
        int[] a = {10, 20, 30};
        int[] b = new int[]{10, 20, 30};
        b[0] = 99;
        System.out.println("a[0]=" + a[0]);
        System.out.println("b[0]=" + b[0]);
        System.out.println("same object? " + (a == b));
    }
}
`,
      goal: "You should see two heap boxes. a[0] stays 10.",
    },
    {
      id: "pass-by-value",
      kind: "run",
      title: "Pass-by-value, including references",
      brief: "The parameter `p` receives a copy of the reference. Mutating `p[0]` hits the same array. Reassigning `p` does not change `a`.",
      code: `public class Main {
    static void bump(int[] p) {
        p[0] = p[0] + 1;
        p = new int[]{0};
    }

    public static void main(String[] args) {
        int[] a = {10, 20, 30};
        bump(a);
        System.out.println("a[0]=" + a[0]);
        System.out.println("a.length=" + a.length);
    }
}
`,
      goal: "Predict: a[0] becomes 11. a is still length 3. The `new int[]{0}` is a local TV that main never sees.",
    },
    {
      id: "equals",
      kind: "run",
      title: "== vs equals, identity vs contents",
      brief: "`==` on references is object identity. Arrays do not override `equals` usefully — use `Arrays.equals` for content.",
      code: `import java.util.Arrays;

public class Main {
    public static void main(String[] args) {
        int[] a = {10, 20, 30};
        int[] b = a;
        int[] c = new int[]{10, 20, 30};
        System.out.println("a==b " + (a == b));
        System.out.println("a==c " + (a == c));
        System.out.println("a.equals(c) " + a.equals(c));
        System.out.println("Arrays.equals " + Arrays.equals(a, c));
        System.out.println("null==a " + (null == a));
    }
}
`,
      goal: "Same contents, different object: == is false. That's not a bug in Java. That's the rule.",
    },
    {
      id: "debug-alias",
      kind: "debug",
      title: "Debug: the inventory that lies",
      story: "A shop program copies a stock array into a 'receipt' and then discounts the receipt. The warehouse stock drops too. Fix it so warehouse stock stays 10, 20, 30 while the receipt can change.",
      expected: "warehouse: 10,20,30",
      brokenCode: `public class Main {
    public static void main(String[] args) {
        int[] warehouse = {10, 20, 30};
        int[] receipt = warehouse; // bug lives here
        receipt[0] = 0;
        System.out.print("warehouse: ");
        for (int i = 0; i < warehouse.length; i++) {
            if (i > 0) System.out.print(",");
            System.out.print(warehouse[i]);
        }
        System.out.println();
    }
}
`,
      hintLadder: [
        "Expected warehouse 10,20,30. Actual is not that. What does receipt refer to?",
        "The discount mutated an object. Which variables pointed at that object?",
        "Copy the reference and you share mutation. Copy the object (`clone` or `Arrays.copyOf` or `new int[]{...}`) and you don't.",
        "Replace the alias with a real copy, run, and check the warehouse line.",
      ],
      passWhen: {
        stdoutIncludes: "warehouse: 10,20,30",
        mustNotContain: ["int[] receipt = warehouse"],
      },
    },
    {
      id: "explain-back",
      kind: "explain",
      title: "Explain it back",
      prompt: "In a few sentences, what does `int[] b = a` copy? What happens when you write `b[0] = 99`? What would be different if you wrote `int[] b = new int[]{10,20,30}` instead? Do not say that Java passes objects by reference.",
      mustInclude: ["reference", "object"],
      niceInclude: ["alias", "identity", "new"],
      traps: ["pass objects by reference", "b is another array", "b is a copy of the array"],
    },
    {
      id: "transfer-method",
      kind: "transfer",
      title: "Unfamiliar variation",
      prompt: "This is not the snippet you memorized. After `mystery(x)`, what is `x[1]`?",
      code: `static void mystery(int[] p) {
    p[1] = 4;
    p = new int[]{9, 9, 9};
    p[1] = 7;
}

int[] x = {1, 2, 3};
mystery(x);`,
      choices: [
        { id: "2", label: "2" },
        { id: "4", label: "4" },
        { id: "7", label: "7" },
        { id: "9", label: "9" },
      ],
      correctId: "4",
      misconception: {
        "2": "alias-as-copy",
        "7": "pass-by-reference-myth",
        "9": "pass-by-reference-myth",
      },
      why: [
        "`p` starts as a copy of the reference in `x`. `p[1] = 4` mutates that array. `x[1]` is 4.",
        "`p = new int[]{9,9,9}` rebinds only the local parameter. `x` still points at the original.",
        "`p[1] = 7` mutates the new local array. `x` never sees 7.",
      ],
    },
    {
      id: "mastery-gate",
      kind: "mastery",
      title: "Mastery is evidence, not a Complete button",
      checks: [
        {
          id: "m1",
          prompt: "After `int[] b = a;` how many array objects exist (assuming `a` already referenced one)?",
          choices: [
            { id: "1", label: "One" },
            { id: "2", label: "Two" },
            { id: "0", label: "Zero — arrays aren't objects" },
          ],
          correctId: "1",
        },
        {
          id: "m2",
          prompt: "Java method calls are:",
          choices: [
            { id: "pbv", label: "Pass-by-value (reference values are copied)" },
            { id: "pbr", label: "Pass-by-reference (parameters are aliases of the caller's variables)" },
            { id: "both", label: "Pass-by-value for primitives, pass-by-reference for objects" },
          ],
          correctId: "pbv",
        },
        {
          id: "m3",
          prompt: "`a == b` for two arrays is true when:",
          choices: [
            { id: "id", label: "They are the same object" },
            { id: "eq", label: "They have the same length and elements" },
            { id: "str", label: "Their toString() matches" },
          ],
          correctId: "id",
        },
      ],
    },
  ],
};
