/** Fast source checks for shared typography and the single icon family. */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const glyphs = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json');
const problems = [];
function files(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? (entry.name === '__tests__' ? [] : files(file)) : /\.tsx?$/.test(file) ? [file] : [];
    });
}
for (const file of [...files('app'), ...files('components'), ...files('styles')]) {
    const source = fs.readFileSync(file, 'utf8');
    // One look: no accent-tinted fills or outlines (a chosen thing is filled
    // solid, everything else is matte), one switch, one text field.
    source.split('\n').forEach((line, index) => {
        if (!line.includes('ui-allow') && /(backgroundColor|borderColor): [^,}]*\b(accent|primary|accentColor|accentText)\b \+ '[0-9a-fA-F]{2}'/.test(line)) {
            problems.push(`${file}:${index + 1} Accent tint: use MatteSurface, or a solid colour for a chosen state.`);
        }
        // One type voice: sentence case, no spaced-out capitals.
        if (!line.includes('ui-allow') && (/letterSpacing: [1-9]/.test(line) || /textTransform: 'uppercase'/.test(line))) {
            problems.push(`${file}:${index + 1} Spaced capitals: headings are SectionTitle, labels are sentence case.`);
        }
        // Apple's minimum text size is 11 pt (HIG typography › Ensuring legibility).
        const small = line.match(/fontSize: *(?:ms\()?(\d+(?:\.\d+)?)\b/);
        if (!line.includes('ui-allow') && small && Number(small[1]) < 11) {
            problems.push(`${file}:${index + 1} Text under 11 pt: Apple's minimum is 11 (use 11 or a Typography style).`);
        }
        // A Pressable whose style is a function does not lay out as a row here.
        if (/style=\{\(\{ pressed \}\)/.test(line)) {
            problems.push(`${file}:${index + 1} Pressable style function: use a static style (it breaks flex rows).`);
        }
    });
    if (file !== 'components/ui/AppSwitch.tsx' && /import \{[^}]*\bSwitch\b[^}]*\} from 'react-native'/.test(source)) {
        problems.push(`${file} Use AppSwitch from components/ui, not React Native's Switch.`);
    }
    const ownInputs = ['components/ui/MatteInput.tsx', 'components/ui/AppTextField.tsx', 'components/Profile/ProfileView.tsx', 'components/Create/GoalUnitPicker.tsx'];
    if (!ownInputs.includes(file) && /<TextInput\b/.test(source)) {
        problems.push(`${file} Use MatteInput or AppTextField, not a bare TextInput.`);
    }
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function report(node, message) {
        problems.push(`${file}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1} ${message}`);
    }
    function visit(node) {
        if (ts.isImportDeclaration(node) && file !== 'components/ui/AppIcon.tsx' &&
            /^(?:@expo\/vector-icons|lucide-react-native|(?:@react-native-|react-native-)vector-icons)/.test(node.moduleSpecifier.text)) {
            report(node, 'Import icons through components/ui/AppIcon.');
        }
        if (ts.isPropertyAssignment(node)) {
            if (node.name.getText(ast) === 'fontFamily' && ts.isStringLiteral(node.initializer) && /Lexend|SpaceGrotesk/.test(node.initializer.text)) {
                report(node, 'Use a FontFamily token.');
            }
            if (node.name.getText(ast) === 'fontWeight') report(node, 'Use the corresponding loaded FontFamily weight.');
        }
        if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && ['Ionicons', 'AppIcon'].includes(node.tagName.getText(ast))) {
            const name = node.attributes.properties.find(attr => ts.isJsxAttribute(attr) && attr.name.getText(ast) === 'name');
            if (name?.initializer && ts.isStringLiteral(name.initializer) && !Object.hasOwn(glyphs, name.initializer.text)) {
                report(name, `Unknown Ionicons glyph: ${name.initializer.text}`);
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(ast);
}
if (problems.length) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
} else {
    console.log('UI consistency checks passed: one icon source, valid glyphs, shared font families.');
}
