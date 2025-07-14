import { Injectable, Logger } from '@nestjs/common';
const Parser = require('tree-sitter');
const Python = require('tree-sitter-python');

@Injectable()
export class TreeSitterParserService {
  private readonly logger = new Logger(TreeSitterParserService.name);
  private parser: any;

  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(Python);
    this.logger.log('🌳 Tree-sitter Python parser initialized');
  }

  /**
   * 코드를 파싱하여 Tree-sitter 트리 반환
   */
  parseCode(code: string): any {
    try {
      const parseStart = Date.now();
      const tree = this.parser.parse(code);
      const parseEnd = Date.now();
      
      this.logger.log(`🌳 Tree-sitter parsing took: ${parseEnd - parseStart}ms`);
      return tree;
    } catch (error) {
      this.logger.error('Tree-sitter parsing failed:', error.message);
      throw error;
    }
  }

  /**
   * AST 노드에서 구조적 지문 추출
   */
  extractStructuralFingerprint(node: any): string {
    try {
      const fingerprintStart = Date.now();
      const fingerprint = this.buildFingerprint(node);
      const fingerprintEnd = Date.now();
      
      this.logger.log(`🔍 Structural fingerprint extraction took: ${fingerprintEnd - fingerprintStart}ms`);
      this.logger.log(`🔍 Fingerprint preview: ${fingerprint.substring(0, 100)}...`);
      
      return fingerprint;
    } catch (error) {
      this.logger.error('Fingerprint extraction failed:', error.message);
      throw error;
    }
  }

  /**
   * 재귀적으로 구조적 지문 생성
   */
  private buildFingerprint(node: any): string {
    const nodeType = this.normalizeNodeType(node);
    
    // 무시할 노드 타입들
    if (this.shouldIgnoreNode(nodeType)) {
      return '';
    }
    
    // 자식 노드들 재귀 처리
    const children = node.children
      ?.map(child => this.buildFingerprint(child))
      ?.filter(child => child && child.length > 0)
      ?.join(',') || '';
    
    return children.length > 0 ? `${nodeType}(${children})` : nodeType;
  }

  /**
   * 무시할 노드 타입 판단
   */
  private shouldIgnoreNode(nodeType: string): boolean {
    const ignoredTypes = [
      'COMMENT',           // 주석 무시
      '(',                 // 괄호 무시
      ')',
      ',',                 // 쉼표 무시
      ':',                 // 콜론 무시
      '=',                 // 등호 무시
      'EXPR_STMT',         // 표현식 문장 래퍼 무시
      // ARGUMENTLIST, PARAMETERS, BLOCK은 제거 - 구조 구분에 중요
    ];
    
    return ignoredTypes.includes(nodeType);
  }

  /**
   * 노드 타입을 정규화하여 구조적 동일성 확보
   */
  private normalizeNodeType(node: any): string {
    if (!node || !node.type) {
      return 'UNKNOWN';
    }

    switch (node.type) {
      // 무시할 구문 요소들
      case 'comment':
        return 'COMMENT';  // shouldIgnoreNode에서 필터링됨
      // 구조적으로 중요한 요소들 (다시 포함)
      case 'argument_list':
        return 'ARGS';  // 함수 호출 패턴 구분에 중요
      case 'parameters':
        return 'PARAMS';  // 함수 정의 패턴 구분에 중요
      case 'block':
        return 'BLOCK';  // 중첩 구조 구분에 중요
      case 'subscript':
        return 'SUBSCRIPT';  // 배열 접근 패턴
      case '(':
      case ')':
      case ',':
      case ':':
      case '=':
        return node.type;  // shouldIgnoreNode에서 필터링됨
        
      // 식별자 (변수명 등) - 유효성 검사 추가
      case 'identifier':
        // 유효하지 않은 식별자 (한글, 특수문자 등) 체크
        if (this.isInvalidIdentifier(node.text)) {
          return `ERR[invalid_id:${node.text?.substring(0, 10) || 'unknown'}]`;
        }
        return 'ID';
      
      // 숫자 리터럴 - 값은 유지 (로직에 영향)
      case 'integer':
      case 'float':
        return `NUM(${node.text})`;
      
      // 문자열 리터럴 - 추상화
      case 'string':
        return 'STR';
      
      // ERROR 노드 - 오류 내용의 일부만 포함
      case 'ERROR':
        const errorText = node.text?.substring(0, 10) || 'unknown';
        return `ERR[${errorText}]`;
      
      // 할당문
      case 'assignment':
        return 'ASSIGN';
      
      // 제어 구조 (핵심만)
      case 'while_statement':
        return 'WHILE';
      case 'if_statement':
        return 'IF';
      case 'for_statement':
        return 'FOR';
      case 'elif_clause':
        return 'ELIF';
      case 'else_clause':
        return 'ELSE';
      
      // 함수 관련
      case 'function_definition':
        return 'FUNC_DEF';
      case 'call':
        return 'CALL';
      case 'return_statement':
        return 'RETURN';
      
      // 연산자 (핵심만)
      case 'binary_operator':
        return 'BINOP';
      case 'comparison_operator':
        return 'COMPARE';
      
      // 리스트/딕셔너리
      case 'list':
        return 'LIST';
      case 'dictionary':
        return 'DICT';
      
      // 기본값: 대문자로 변환
      default:
        return node.type.toUpperCase().replace(/_/g, '');
    }
  }

  /**
   * 유효하지 않은 식별자 검사
   */
  private isInvalidIdentifier(text: string): boolean {
    if (!text) return true;
    
    // Python 유효 식별자 패턴: 영문자/언더스코어로 시작, 영문자/숫자/언더스코어만 포함
    const validIdentifierPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    
    return !validIdentifierPattern.test(text);
  }

  /**
   * 파싱 통계 정보 반환
   */
  getParsingStats(tree: any): { nodeCount: number; errorCount: number; depth: number } {
    let nodeCount = 0;
    let errorCount = 0;
    let maxDepth = 0;

    const traverse = (node: any, depth: number = 0) => {
      nodeCount++;
      maxDepth = Math.max(maxDepth, depth);
      
      if (node.type === 'ERROR') {
        errorCount++;
      }
      
      node.children?.forEach(child => traverse(child, depth + 1));
    };

    traverse(tree.rootNode);
    
    return { nodeCount, errorCount, depth: maxDepth };
  }
}
