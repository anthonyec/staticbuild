"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dns_1 = require("dns");
const os_1 = require("os");
var State;
(function (State) {
    // TODO: Is there a way to define enums as string without writing them all?
    State["DATA"] = "DATA";
    State["TAG_OPEN"] = "TAG_OPEN";
    State["END_TAG_OPEN"] = "END_TAG_OPEN";
    State["TAG_NAME"] = "TAG_NAME";
    State["BEFORE_ATTRIBUTE_NAME"] = "BEFORE_ATTRIBUTE_NAME";
    State["ATTRIBUTE_NAME"] = "ATTRIBUTE_NAME";
    State["AFTER_ATTRIBUTE_NAME"] = "AFTER_ATTRIBUTE_NAME";
    State["BEFORE_ATTRIBUTE_VALUE"] = "BEFORE_ATTRIBUTE_VALUE";
    State["ATTRIBUTE_VALUE_DOUBLE_QUOTED"] = "ATTRIBUTE_VALUE_DOUBLE_QUOTED";
    State["ATTRIBUTE_VALUE_SINGLE_QUOTED"] = "ATTRIBUTE_VALUE_SINGLE_QUOTED";
    State["ATTRIBUTE_VALUE_UNQUOTED"] = "ATTRIBUTE_VALUE_UNQUOTED";
    State["ATTRIBUTE_VALUE_QUOTED"] = "ATTRIBUTE_VALUE_QUOTED";
    State["AFTER_ATTRIBUTE_VALUE"] = "AFTER_ATTRIBUTE_VALUE";
    State["BEFORE_DOCTYPE"] = "BEFORE_DOCTYPE";
    State["DOCTYPE"] = "DOCTYPE";
    State["DOCTYPE_NAME"] = "DOCTYPE_NAME";
    State["AFTER_DOCTYPE_NAME"] = "AFTER_DOCTYPE_NAME";
    State["PLAINTEXT"] = "PLAINTEXT";
    State["CHARACTER_REFERENCE"] = "CHARACTER_REFERENCE";
    State["NAMED_CHARACTER_REFERENCE"] = "NAMED_CHARACTER_REFERENCE";
    State["SELF_CLOSING_START_TAG"] = "SELF_CLOSING_START_TAG";
})(State || (State = {}));
var Token;
(function (Token) {
    Token["START_TAG"] = "START_TAG";
    Token["CHARACTER_TOKEN"] = "CHARACTER_TOKEN";
    Token["EOL"] = "EOL";
})(Token || (Token = {}));
function isASCIIAlpha(character) {
    return true;
}
function isASCIIUpperAlpha(character) {
    return true;
}
function isASCIIAlphaNumeric(character) {
    return false;
}
function tokenize(html) {
    const tokens = [];
    const _tokens = [];
    let currentIndex = 0;
    let currentState = State.DATA;
    let returnState = currentState;
    let temporaryBuffer = '';
    function consumeNextInputCharacter() {
        // const char = html[currentIndex];
        currentIndex++;
        // return char;
        return html[currentIndex];
    }
    function emitCurrentInputCharacter(token) { }
    function emitToken(token) { }
    function emitCurrentTagToken() { }
    function setReturnState(state) {
        returnState = state;
    }
    function switchToState(state) {
        currentState = state;
    }
    function reconsumeInState(state) {
        switchToState(state);
    }
    function createNewToken(token, properties) {
        tokens.push({ type: token, properties });
    }
    function appendToLastToken(properties) {
        // tokens[tokens.length - 1]
    }
    function flushCodePoints() { }
    const states = {
        [State.DATA]: () => {
            const char = consumeNextInputCharacter();
            if (char === '&') {
                setReturnState(State.DATA);
                switchToState(State.CHARACTER_REFERENCE);
            }
            else if (char === '<') {
                switchToState(State.TAG_OPEN);
            }
            else if (char === null) {
                // TODO: Implement!
                // emitCurrentInputCharacter(Token.CHARACTER_TOKEN)
            }
            else if (char === os_1.EOL) {
                emitToken(Token.EOL);
            }
            else {
                // TODO: Implement!
                // emitCurrentInputCharacter(Token.CHARACTER_TOKEN)
            }
        },
        [State.TAG_OPEN]: () => {
            const char = consumeNextInputCharacter();
            if (isASCIIAlpha(char)) {
                createNewToken(Token.START_TAG, { name: '' });
                reconsumeInState(State.TAG_NAME);
            }
            else {
                throw new Error('Blah');
            }
        },
        [State.END_TAG_OPEN]: () => { },
        [State.TAG_NAME]: () => {
            const char = consumeNextInputCharacter();
            if (char === '\t' || char === 'lf' || char === '\ff' || char === ' ') {
                switchToState(State.BEFORE_ATTRIBUTE_NAME);
            }
            else if (char === '/') {
                switchToState(State.SELF_CLOSING_START_TAG);
            }
            else if (char === '>') {
                switchToState(State.DATA);
                emitCurrentTagToken();
            }
            else if (isASCIIUpperAlpha(char)) {
                // appendToLastToken()
            }
            else if (char === null) {
                // appendToLastToken()
            }
            else if (char === dns_1.EOF) {
                emitToken(Token.EOL);
                // emitToken(createEndOfFileToken())
            }
            else {
                // appendToLastToken()
            }
        },
        [State.CHARACTER_REFERENCE]: () => {
            temporaryBuffer = '';
            temporaryBuffer += '&';
            const char = consumeNextInputCharacter();
            if (isASCIIAlphaNumeric(char)) {
                reconsumeInState(State.NAMED_CHARACTER_REFERENCE);
            }
            else if (char === '#') {
                temporaryBuffer += html[currentIndex - 1];
            }
            else {
                flushCodePoints();
                reconsumeInState(returnState);
            }
        },
        [State.BEFORE_ATTRIBUTE_NAME]: () => {
            const char = consumeNextInputCharacter();
            // TODO: Put real chars here for tab and line feed etc.
            if (char === `\t` || char === `\lf` || char === `ff` || char === ' ') {
                // Ignore character.
                return;
            }
            else if (char === '/' || char === '>' || char === dns_1.EOF) {
                reconsumeInState(State.AFTER_ATTRIBUTE_NAME);
            }
            else if (char === '=') {
                // TODO: Implement!
                // createNewAttribute(currentTagToken, char, '');
                switchToState(State.ATTRIBUTE_NAME);
            }
            else {
                // createNewAttribute(currentTagToken, '', '');
                reconsumeInState(State.ATTRIBUTE_NAME);
            }
        },
        [State.ATTRIBUTE_NAME]: () => {
            const char = consumeNextInputCharacter();
            if (char === `\t` ||
                char === `\lf` ||
                char === `ff` ||
                char === ' ' ||
                char === '/' ||
                char === '>' ||
                char === dns_1.EOF) {
                reconsumeInState(State.AFTER_ATTRIBUTE_NAME);
            }
            else if (char === '=') {
                switchToState(State.BEFORE_ATTRIBUTE_NAME);
            }
            else if (isASCIIUpperAlpha(char)) {
                // appendToLastToken
            }
            else if (char === null) {
                // TODO: Implement
            }
            else if (char === `"` || char === `'` || char === '<') {
                // Throw error but do
                // appendToLastToken
            }
            else {
                // appendToLastToken
            }
        },
        [State.AFTER_ATTRIBUTE_NAME]: () => {
            const char = consumeNextInputCharacter();
            if (char === `\t` || char === `\lf` || char === `ff` || char === ' ') {
                // ignore
            }
            else if (char === '/') {
                switchToState(State.SELF_CLOSING_START_TAG);
            }
            else if (char === '=') {
                switchToState(State.BEFORE_ATTRIBUTE_VALUE);
            }
            else if (char === dns_1.EOF) {
                // error
                emitToken(Token.EOL);
            }
            else {
                // createNewAttribute(currentTagToken, '', '');
                reconsumeInState(State.ATTRIBUTE_NAME);
            }
        },
        [State.BEFORE_ATTRIBUTE_VALUE]: () => { },
        [State.ATTRIBUTE_VALUE_DOUBLE_QUOTED]: () => { },
        [State.ATTRIBUTE_VALUE_SINGLE_QUOTED]: () => { },
        [State.ATTRIBUTE_VALUE_UNQUOTED]: () => { },
        [State.ATTRIBUTE_VALUE_QUOTED]: () => { },
        [State.AFTER_ATTRIBUTE_VALUE]: () => { },
        [State.BEFORE_DOCTYPE]: () => { },
        [State.DOCTYPE]: () => { },
        [State.DOCTYPE_NAME]: () => { },
        [State.AFTER_DOCTYPE_NAME]: () => { },
        [State.PLAINTEXT]: () => { },
        [State.NAMED_CHARACTER_REFERENCE]: () => { }
    };
    while (currentIndex < html.length) {
        states[currentState]();
        console.log(currentState, html[currentIndex]);
    }
    return tokens;
}
console.time('parse');
const t = tokenize('&######## <html> <body class="john bong">HELLO</body>');
console.timeEnd('parse');
console.log('run');
console.log(t);
//# sourceMappingURL=tokenize.js.map