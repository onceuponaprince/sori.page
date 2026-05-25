import { Node, mergeAttributes } from "@tiptap/core";

export const SceneBreak = Node.create({
  name: "sceneBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: 'hr[data-scene-break="true"]' }],
  renderHTML: () => [
    "hr",
    {
      "data-scene-break": "true",
      class: "sori-scene-break my-8 border-border",
    },
  ],
});

function blockNode(name: string, className: string, tag = "p") {
  return Node.create({
    name,
    group: "block",
    content: "text*",
    parseHTML: () => [{ tag: `${tag}[data-${name}="true"]` }],
    renderHTML: ({ HTMLAttributes }) => [
      tag,
      mergeAttributes(HTMLAttributes, {
        [`data-${name}`]: "true",
        class: className,
      }),
      0,
    ],
  });
}

export const ScriptSceneHeading = blockNode(
  "scriptSceneHeading",
  "sori-script-scene-heading uppercase tracking-wide text-sm font-semibold mt-6 mb-2",
);

export const ScriptAction = blockNode(
  "scriptAction",
  "sori-script-action mb-2",
);

export const ScriptCharacter = blockNode(
  "scriptCharacter",
  "sori-script-character uppercase text-center font-semibold mt-4 mb-1",
);

export const ScriptParenthetical = blockNode(
  "scriptParenthetical",
  "sori-script-parenthetical text-center italic text-sm mb-1",
);

export const ScriptDialogue = blockNode(
  "scriptDialogue",
  "sori-script-dialogue max-w-md mx-auto mb-3",
);

export const playgroundEditorExtensions = [
  SceneBreak,
  ScriptSceneHeading,
  ScriptAction,
  ScriptCharacter,
  ScriptParenthetical,
  ScriptDialogue,
];
