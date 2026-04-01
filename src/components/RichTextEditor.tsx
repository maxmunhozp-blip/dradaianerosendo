import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import FontFamily from "@tiptap/extension-font-family";
import { TextStyle } from "@tiptap/extension-text-style";
import { Extension } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Undo,
  Redo,
  Minus,
  IndentIncrease,
  IndentDecrease,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, forwardRef, useImperativeHandle } from "react";

export interface RichTextEditorHandle {
  getHTML: () => string;
}

interface RichTextEditorProps {
  initialContent: string;
  className?: string;
}

// Custom Indent extension
const Indent = Extension.create({
  name: "indent",
  addOptions() {
    return {
      types: ["heading", "paragraph"],
      indentRange: 40,
      minIndentLevel: 0,
      maxIndentLevel: 200,
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            renderHTML: (attributes: Record<string, number>) => {
              if (!attributes.indent) return {};
              return { style: `margin-left: ${attributes.indent}px` };
            },
            parseHTML: (element: HTMLElement) => {
              const ml = element.style.marginLeft;
              return ml ? parseInt(ml, 10) || 0 : 0;
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      indent:
        () =>
        ({ tr, state, dispatch }: any) => {
          const { selection } = state;
          state.doc.nodesBetween(selection.from, selection.to, (node: any, pos: number) => {
            if (this.options.types.includes(node.type.name)) {
              const current = node.attrs.indent || 0;
              const next = Math.min(current + this.options.indentRange, this.options.maxIndentLevel);
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
            }
          });
          if (dispatch) dispatch(tr);
          return true;
        },
      outdent:
        () =>
        ({ tr, state, dispatch }: any) => {
          const { selection } = state;
          state.doc.nodesBetween(selection.from, selection.to, (node: any, pos: number) => {
            if (this.options.types.includes(node.type.name)) {
              const current = node.attrs.indent || 0;
              const next = Math.max(current - this.options.indentRange, this.options.minIndentLevel);
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
            }
          });
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => (this.editor as any).commands.indent(),
      "Shift-Tab": () => (this.editor as any).commands.outdent(),
    };
  },
});

const FONTS = [
  { label: "Inter", value: "Inter" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Arial", value: "Arial" },
  { label: "Georgia", value: "Georgia" },
  { label: "Courier New", value: "Courier New" },
  { label: "Garamond", value: "Garamond" },
];

function plainTextToHtml(text: string): string {
  const lines = text.split("\n");
  let html = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      html += "<p></p>";
      continue;
    }
    if (
      (trimmed === trimmed.toUpperCase() && trimmed.length < 80 && trimmed.length > 2 && !trimmed.startsWith("---")) ||
      trimmed.match(/^(PROCURAÇÃO|OUTORGANTE|OUTORGADA|PODERES|FINALIDADE|DO DIREITO|DA TUTELA|DOS PEDIDOS|DOS FATOS)/)
    ) {
      html += `<h2><strong>${trimmed}</strong></h2>`;
    } else if (trimmed === "---" || trimmed === "___") {
      html += "<hr />";
    } else {
      html += `<p>${trimmed}</p>`;
    }
  }
  return html;
}

const ToolbarButton = ({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title: string;
}) => (
  <Button
    type="button"
    variant={active ? "default" : "ghost"}
    size="sm"
    className="h-7 w-7 p-0"
    onClick={onClick}
    title={title}
  >
    {children}
  </Button>
);

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ initialContent, className }, ref) => {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        TextAlign.configure({
          types: ["heading", "paragraph"],
        }),
        Underline,
        TextStyle,
        FontFamily,
        Indent,
      ],
      content: "",
      editorProps: {
        attributes: {
          class:
            "prose prose-sm max-w-none min-h-[50vh] p-4 focus:outline-none [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-bold [&_h3]:mb-1 [&_p]:mb-1 [&_p]:leading-relaxed [&_hr]:my-3",
        },
      },
    });

    useEffect(() => {
      if (editor && initialContent) {
        const html = initialContent.includes("<") ? initialContent : plainTextToHtml(initialContent);
        editor.commands.setContent(html);
      }
    }, [editor, initialContent]);

    useImperativeHandle(ref, () => ({
      getHTML: () => editor?.getHTML() || "",
    }));

    if (!editor) return null;

    const currentFont = editor.getAttributes("textStyle").fontFamily || "Inter";

    return (
      <div className={`border border-border rounded-md overflow-hidden ${className || ""}`}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/50">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            title="Desfazer"
          >
            <Undo className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            title="Refazer"
          >
            <Redo className="w-3.5 h-3.5" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-5" />

          {/* Font selector */}
          <Select
            value={currentFont}
            onValueChange={(val) =>
              editor.chain().focus().setFontFamily(val).run()
            }
          >
            <SelectTrigger className="h-7 w-[110px] text-[11px] border-border bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map((f) => (
                <SelectItem key={f.value} value={f.value} className="text-xs" style={{ fontFamily: f.value }}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive("heading", { level: 1 })}
            title="Título 1"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            title="Título 2"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
            title="Título 3"
          >
            <Heading3 className="w-3.5 h-3.5" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Negrito"
          >
            <Bold className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Itálico"
          >
            <Italic className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
            title="Sublinhado"
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            active={editor.isActive({ textAlign: "left" })}
            title="Alinhar à esquerda"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            active={editor.isActive({ textAlign: "center" })}
            title="Centralizar"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            active={editor.isActive({ textAlign: "right" })}
            title="Alinhar à direita"
          >
            <AlignRight className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
            active={editor.isActive({ textAlign: "justify" })}
            title="Justificar"
          >
            <AlignJustify className="w-3.5 h-3.5" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-5" />

          {/* Indent / Outdent */}
          <ToolbarButton
            onClick={() => (editor.commands as any).outdent()}
            title="Diminuir recuo"
          >
            <IndentDecrease className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => (editor.commands as any).indent()}
            title="Aumentar recuo"
          >
            <IndentIncrease className="w-3.5 h-3.5" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Lista"
          >
            <List className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Lista numerada"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Linha horizontal"
          >
            <Minus className="w-3.5 h-3.5" />
          </ToolbarButton>
        </div>

        {/* Editor content */}
        <div className="overflow-y-auto max-h-[55vh] bg-white">
          <EditorContent editor={editor} />
        </div>
      </div>
    );
  }
);

RichTextEditor.displayName = "RichTextEditor";

export default RichTextEditor;
