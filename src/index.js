/**
 * PitchPerfect - Football Writing Assistant
 * Main editor entry point
 */

const { registerPlugin } = wp.plugins;
const { PluginSidebar, PluginSidebarMoreMenuItem } = wp.editPost;
const { PanelBody, Button, Spinner, SelectControl, ToggleControl, Notice } = wp.components;
const { useSelect, useDispatch, dispatch, select } = wp.data;
const { useState, useEffect, useCallback, Fragment, createElement, useMemo } = wp.element;
const { __ } = wp.i18n;
const apiFetch = wp.apiFetch;

// Severity colors
const SEVERITY_COLORS = {
    error: '#dc3232',
    warning: '#f0b849',
    info: '#00a0d2',
};

// Type labels
const TYPE_LABELS = {
    grammar: 'Grammar',
    spelling: 'Spelling',
    clarity: 'Clarity',
    style: 'Style',
    headline: 'Headline',
    terminology: 'Terminology',
    consistency: 'Consistency',
    speculation: 'Speculation',
    repetition: 'Repetition',
    rewrite: 'Rewrite',
    seo: 'SEO',
    readability: 'Readability',
    tone: 'Tone',
};

// Type icons (using dashicons)
const TYPE_ICONS = {
    grammar: 'editor-spellcheck',
    spelling: 'editor-spellcheck',
    clarity: 'visibility',
    style: 'art',
    headline: 'heading',
    terminology: 'translation',
    consistency: 'update',
    speculation: 'warning',
    repetition: 'controls-repeat',
    rewrite: 'editor-contract',
    seo: 'chart-line',
    readability: 'book-alt',
    tone: 'format-status',
};

/**
 * Main Sidebar Component
 */
const PitchPerfectSidebar = () => {
    const [suggestions, setSuggestions] = useState([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [lastAnalyzed, setLastAnalyzed] = useState(null);
    const [filterType, setFilterType] = useState('all');
    const [filterSeverity, setFilterSeverity] = useState('all');
    const [dismissedIds, setDismissedIds] = useState(new Set());
    const [expandedId, setExpandedId] = useState(null);
    const [error, setError] = useState(null);
    const [rewriteMode, setRewriteMode] = useState('shorten');
    const [rewriteSuggestions, setRewriteSuggestions] = useState([]);
    const [isRewriting, setIsRewriting] = useState(false);
    const [rewriteError, setRewriteError] = useState(null);
    const { editPost } = useDispatch('core/editor');

    const getPlainTextFromHtml = (html) => {
        const container = document.createElement('div');
        container.innerHTML = html;
        return container.textContent || container.innerText || '';
    };

    const getContextSnippet = (text, start, end) => {
        if (!text || start == null || end == null) {
            return null;
        }
        const safeStart = Math.max(0, start - 40);
        const safeEnd = Math.min(text.length, end + 40);
        return {
            before: text.slice(safeStart, start),
            match: text.slice(start, end),
            after: text.slice(end, safeEnd),
        };
    };

    const analysisText = useMemo(() => {
        const fullContent = `<h1>${postTitle || ''}</h1>\n${postContent}`;
        return getPlainTextFromHtml(fullContent);
    }, [postContent, postTitle]);

    const documentStats = useMemo(() => {
        if (!analysisText) {
            return { words: 0, sentences: 0, paragraphs: 0 };
        }
        const words = analysisText.trim() ? analysisText.trim().split(/\s+/).length : 0;
        const sentences = analysisText.split(/[.!?]+/).filter(Boolean).length;
        const paragraphs = analysisText.split(/\n\s*\n/).filter((para) => para.trim()).length;
        return { words, sentences, paragraphs };
    }, [analysisText]);

    // Get post content and metadata
    const { postContent, postId, postTitle } = useSelect((select) => {
        const editor = select('core/editor');
        return {
            postContent: editor.getEditedPostContent(),
            postId: editor.getCurrentPostId(),
            postTitle: editor.getEditedPostAttribute('title'),
        };
    }, []);

    const replaceFirstOccurrence = (source, search, replacement) => {
        if (!source || !search) {
            return null;
        }
        const index = source.indexOf(search);
        if (index === -1) {
            return null;
        }
        return source.slice(0, index) + replacement + source.slice(index + search.length);
    };

    const applyTextReplacement = (original, replacement) => {
        const updatedContent = replaceFirstOccurrence(postContent, original, replacement);
        if (updatedContent !== null) {
            editPost({ content: updatedContent });
            return true;
        }

        const updatedTitle = replaceFirstOccurrence(postTitle, original, replacement);
        if (updatedTitle !== null) {
            editPost({ title: updatedTitle });
            return true;
        }

        return false;
    };

    /**
     * Analyse content via REST API
     */
    const analyseContent = useCallback(async () => {
        if (!postContent && !postTitle) {
            setSuggestions([]);
            return;
        }

        setIsAnalyzing(true);
        setError(null);

        try {
            const fullContent = `<h1>${postTitle || ''}</h1>\n${postContent}`;
            
            const response = await apiFetch({
                path: '/pitchperfect/v1/analyse',
                method: 'POST',
                data: {
                    postId: postId,
                    content: fullContent,
                    language: 'en-GB',
                    context: 'football_article',
                },
            });

            setSuggestions(response.suggestions || []);
            setLastAnalyzed(new Date());
            setDismissedIds(new Set());
        } catch (err) {
            console.error('PitchPerfect analysis error:', err);
            setError(err.message || 'Analysis failed');
        } finally {
            setIsAnalyzing(false);
        }
    }, [postContent, postTitle, postId]);

    /**
     * Filter suggestions
     */
    const filteredSuggestions = suggestions.filter((s) => {
        if (dismissedIds.has(s.id)) return false;
        if (filterType !== 'all' && s.type !== filterType) return false;
        if (filterSeverity !== 'all' && s.severity !== filterSeverity) return false;
        return true;
    });

    /**
     * Get suggestion counts by type
     */
    const suggestionCounts = suggestions.reduce((acc, s) => {
        if (dismissedIds.has(s.id)) return acc;
        acc[s.type] = (acc[s.type] || 0) + 1;
        acc.total = (acc.total || 0) + 1;
        return acc;
    }, { total: 0 });

    /**
     * Dismiss a suggestion
     */
    const dismissSuggestion = (id) => {
        setDismissedIds((prev) => new Set([...prev, id]));
    };

    /**
     * Apply a replacement
     */
    const applyReplacement = async (suggestion, replacement) => {
        const original = suggestion.original || '';
        const applied = original ? applyTextReplacement(original, replacement) : false;

        if (applied) {
            dismissSuggestion(suggestion.id);
            dispatch('core/notices').createNotice(
                'success',
                __('Suggestion applied. Review the change in your content.', 'pitchperfect'),
                { type: 'snackbar', isDismissible: true }
            );
            return;
        }

        dismissSuggestion(suggestion.id);
        dispatch('core/notices').createNotice(
            'warning',
            __('Suggestion dismissed. The editor could not auto-apply this change.', 'pitchperfect'),
            { type: 'snackbar', isDismissible: true }
        );
    };

    const generateRewrites = useCallback(async () => {
        if (!postContent && !postTitle) {
            setRewriteSuggestions([]);
            return;
        }

        setIsRewriting(true);
        setRewriteError(null);

        try {
            const fullContent = `<h1>${postTitle || ''}</h1>\n${postContent}`;

            const response = await apiFetch({
                path: '/pitchperfect/v1/rewrite',
                method: 'POST',
                data: {
                    postId: postId,
                    content: fullContent,
                    mode: rewriteMode,
                },
            });

            setRewriteSuggestions(response.rewrites || []);
        } catch (err) {
            console.error('PitchPerfect rewrite error:', err);
            setRewriteError(err.message || 'Rewrite failed');
        } finally {
            setIsRewriting(false);
        }
    }, [postContent, postTitle, postId, rewriteMode]);

    const applyRewrite = (rewrite) => {
        const applied = applyTextReplacement(rewrite.original, rewrite.rewrite);

        if (applied) {
            dispatch('core/notices').createNotice(
                'success',
                __('Rewrite applied. Review the change in your content.', 'pitchperfect'),
                { type: 'snackbar', isDismissible: true }
            );
            setRewriteSuggestions((prev) => prev.filter((item) => item.id !== rewrite.id));
            return;
        }

        dispatch('core/notices').createNotice(
            'warning',
            __('Rewrite could not be applied automatically.', 'pitchperfect'),
            { type: 'snackbar', isDismissible: true }
        );
    };

    const applySafeFixes = () => {
        const applicable = suggestions.filter((s) => {
            return s.replacements && s.replacements.length > 0 && s.original;
        });
        let appliedCount = 0;

        applicable.forEach((suggestion) => {
            const applied = applyTextReplacement(suggestion.original, suggestion.replacements[0]);
            if (applied) {
                appliedCount += 1;
                dismissSuggestion(suggestion.id);
            }
        });

        dispatch('core/notices').createNotice(
            appliedCount > 0 ? 'success' : 'warning',
            appliedCount > 0
                ? __('Applied safe fixes. Review changes in your content.', 'pitchperfect')
                : __('No safe fixes could be applied automatically.', 'pitchperfect'),
            { type: 'snackbar', isDismissible: true }
        );
    };

    const copyRewrite = async (rewrite) => {
        if (!rewrite?.rewrite) {
            return;
        }

        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(rewrite.rewrite);
            dispatch('core/notices').createNotice(
                'success',
                __('Rewrite copied to clipboard.', 'pitchperfect'),
                { type: 'snackbar', isDismissible: true }
            );
            return;
        }

        dispatch('core/notices').createNotice(
            'warning',
            __('Clipboard access unavailable in this browser.', 'pitchperfect'),
            { type: 'snackbar', isDismissible: true }
        );
    };

    /**
     * Render a single suggestion card
     */
    const renderSuggestion = (suggestion) => {
        const isExpanded = expandedId === suggestion.id;
        const severityColor = SEVERITY_COLORS[suggestion.severity] || SEVERITY_COLORS.info;
        const typeLabel = TYPE_LABELS[suggestion.type] || suggestion.type;
        const typeIcon = TYPE_ICONS[suggestion.type] || 'editor-help';

        const contextSnippet = getContextSnippet(analysisText, suggestion.start, suggestion.end);

        return createElement('div', {
            key: suggestion.id,
            className: 'pitchperfect-suggestion',
            style: {
                borderLeft: `4px solid ${severityColor}`,
                marginBottom: '12px',
                padding: '12px',
                backgroundColor: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                borderRadius: '4px',
            },
        }, [
            // Header
            createElement('div', {
                key: 'header',
                style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px',
                },
            }, [
                createElement('div', {
                    key: 'type-badge',
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                    },
                }, [
                    createElement('span', {
                        key: 'icon',
                        className: `dashicons dashicons-${typeIcon}`,
                        style: { fontSize: '16px', color: severityColor },
                    }),
                    createElement('span', {
                        key: 'label',
                        style: {
                            fontSize: '11px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            color: severityColor,
                        },
                    }, typeLabel),
                    suggestion.confidence != null && createElement('span', {
                        key: 'confidence',
                        className: 'pitchperfect-confidence',
                    }, `${Math.round(suggestion.confidence * 100)}%`),
                ]),
                createElement(Button, {
                    key: 'expand-btn',
                    isSmall: true,
                    icon: isExpanded ? 'arrow-up-alt2' : 'arrow-down-alt2',
                    onClick: () => setExpandedId(isExpanded ? null : suggestion.id),
                    label: isExpanded ? 'Collapse' : 'Expand',
                }),
            ]),
            
            // Message
            createElement('p', {
                key: 'message',
                style: {
                    margin: '0 0 8px 0',
                    fontSize: '13px',
                    lineHeight: '1.5',
                },
            }, suggestion.message),
            
            // Expanded content
            isExpanded && createElement(Fragment, { key: 'expanded' }, [
                contextSnippet && createElement('div', {
                    key: 'context',
                    className: 'pitchperfect-context',
                }, [
                    createElement('span', { key: 'before' }, contextSnippet.before),
                    createElement('mark', { key: 'match' }, contextSnippet.match),
                    createElement('span', { key: 'after' }, contextSnippet.after),
                ]),
                // Explanation
                suggestion.explanation && createElement('p', {
                    key: 'explanation',
                    style: {
                        margin: '8px 0',
                        padding: '8px',
                        backgroundColor: '#f6f7f7',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#50575e',
                        fontStyle: 'italic',
                    },
                }, suggestion.explanation),
                
                // Replacements
                suggestion.replacements && suggestion.replacements.length > 0 && createElement('div', {
                    key: 'replacements',
                    style: { marginTop: '8px' },
                }, [
                    createElement('span', {
                        key: 'label',
                        style: { fontSize: '11px', color: '#757575', display: 'block', marginBottom: '4px' },
                    }, 'Suggested:'),
                    ...suggestion.replacements.map((rep, idx) => 
                        createElement(Button, {
                            key: idx,
                            isSecondary: true,
                            isSmall: true,
                            onClick: () => applyReplacement(suggestion, rep),
                            style: { marginRight: '4px', marginBottom: '4px' },
                        }, rep)
                    ),
                ]),
            ]),
            
            // Actions
            createElement('div', {
                key: 'actions',
                style: {
                    display: 'flex',
                    gap: '8px',
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #e0e0e0',
                },
            }, [
                createElement(Button, {
                    key: 'dismiss',
                    isSmall: true,
                    isDestructive: true,
                    onClick: () => dismissSuggestion(suggestion.id),
                }, __('Dismiss', 'pitchperfect')),
            ]),
        ]);
    };

    /**
     * Render the main sidebar content
     */
    return createElement(Fragment, null, [
        createElement(PluginSidebarMoreMenuItem, {
            key: 'menu-item',
            target: 'pitchperfect-sidebar',
            icon: 'editor-spellcheck',
        }, __('PitchPerfect', 'pitchperfect')),
        
        createElement(PluginSidebar, {
            key: 'sidebar',
            name: 'pitchperfect-sidebar',
            title: __('PitchPerfect', 'pitchperfect'),
            icon: 'editor-spellcheck',
        }, [
            // Analysis Controls
            createElement(PanelBody, {
                key: 'controls',
                title: __('Analysis', 'pitchperfect'),
                initialOpen: true,
            }, [
                createElement(Button, {
                    key: 'analyse-btn',
                    isPrimary: true,
                    isBusy: isAnalyzing,
                    disabled: isAnalyzing,
                    onClick: analyseContent,
                    style: { width: '100%', justifyContent: 'center', marginBottom: '12px' },
                }, isAnalyzing ? __('Analysing...', 'pitchperfect') : __('Analyse Content', 'pitchperfect')),
                suggestions.length > 0 && createElement(Button, {
                    key: 'apply-safe',
                    isSecondary: true,
                    onClick: applySafeFixes,
                    style: { width: '100%', justifyContent: 'center', marginBottom: '12px' },
                }, __('Apply Safe Fixes', 'pitchperfect')),
                
                lastAnalyzed && createElement('p', {
                    key: 'last-analyzed',
                    style: { fontSize: '11px', color: '#757575', margin: '0' },
                }, __('Last analysed: ', 'pitchperfect') + lastAnalyzed.toLocaleTimeString()),
                
                error && createElement(Notice, {
                    key: 'error',
                    status: 'error',
                    isDismissible: true,
                    onRemove: () => setError(null),
                }, error),
            ]),

            createElement(PanelBody, {
                key: 'stats',
                title: __('Document Stats', 'pitchperfect'),
                initialOpen: false,
            }, [
                createElement('div', {
                    key: 'stats-grid',
                    className: 'pitchperfect-stats-grid',
                }, [
                    createElement('div', {
                        key: 'words',
                        className: 'pitchperfect-stat-card',
                    }, [
                        createElement('div', { key: 'count', className: 'pitchperfect-stat-count' }, documentStats.words),
                        createElement('div', { key: 'label', className: 'pitchperfect-stat-label' }, __('Words', 'pitchperfect')),
                    ]),
                    createElement('div', {
                        key: 'sentences',
                        className: 'pitchperfect-stat-card',
                    }, [
                        createElement('div', { key: 'count', className: 'pitchperfect-stat-count' }, documentStats.sentences),
                        createElement('div', { key: 'label', className: 'pitchperfect-stat-label' }, __('Sentences', 'pitchperfect')),
                    ]),
                    createElement('div', {
                        key: 'paragraphs',
                        className: 'pitchperfect-stat-card',
                    }, [
                        createElement('div', { key: 'count', className: 'pitchperfect-stat-count' }, documentStats.paragraphs),
                        createElement('div', { key: 'label', className: 'pitchperfect-stat-label' }, __('Paragraphs', 'pitchperfect')),
                    ]),
                ]),
            ]),

            // Rewrite Tools
            window.pitchPerfectData?.options?.features?.rewrite_tools && createElement(PanelBody, {
                key: 'rewrite',
                title: __('Rewrite Tools', 'pitchperfect'),
                initialOpen: false,
            }, [
                createElement(SelectControl, {
                    key: 'rewrite-mode',
                    label: __('Rewrite Mode', 'pitchperfect'),
                    value: rewriteMode,
                    options: [
                        { label: __('All Modes', 'pitchperfect'), value: 'all' },
                        { label: __('Shorten', 'pitchperfect'), value: 'shorten' },
                        { label: __('Simplify', 'pitchperfect'), value: 'simplify' },
                        { label: __('Punchy', 'pitchperfect'), value: 'punchy' },
                        { label: __('Formal', 'pitchperfect'), value: 'formal' },
                    ],
                    onChange: setRewriteMode,
                }),
                createElement(Button, {
                    key: 'rewrite-btn',
                    isSecondary: true,
                    isBusy: isRewriting,
                    disabled: isRewriting,
                    onClick: generateRewrites,
                    style: { width: '100%', justifyContent: 'center', marginTop: '8px' },
                }, isRewriting ? __('Rewriting...', 'pitchperfect') : __('Generate Rewrites', 'pitchperfect')),
                rewriteError && createElement(Notice, {
                    key: 'rewrite-error',
                    status: 'error',
                    isDismissible: true,
                    onRemove: () => setRewriteError(null),
                }, rewriteError),
                rewriteSuggestions.length === 0 && !isRewriting && createElement('p', {
                    key: 'rewrite-empty',
                    style: { color: '#757575', fontStyle: 'italic' },
                }, __('No rewrite suggestions yet.', 'pitchperfect')),
                rewriteSuggestions.length > 0 && createElement('div', {
                    key: 'rewrite-list',
                    className: 'pitchperfect-rewrite-list',
                }, rewriteSuggestions.map((rewrite) => createElement('div', {
                    key: rewrite.id,
                    className: 'pitchperfect-rewrite-card',
                }, [
                    createElement('div', {
                        key: 'rewrite-mode',
                        className: 'pitchperfect-rewrite-mode',
                    }, rewrite.mode ? rewrite.mode.toUpperCase() : ''),
                    createElement('div', {
                        key: 'rewrite-original',
                        className: 'pitchperfect-rewrite-original',
                    }, rewrite.original),
                    createElement('div', {
                        key: 'rewrite-suggestion',
                        className: 'pitchperfect-rewrite-suggestion',
                    }, rewrite.rewrite),
                    rewrite.explanation && createElement('div', {
                        key: 'rewrite-explanation',
                        className: 'pitchperfect-rewrite-explanation',
                    }, rewrite.explanation),
                    createElement(Button, {
                        key: 'rewrite-apply',
                        isPrimary: true,
                        isSmall: true,
                        onClick: () => applyRewrite(rewrite),
                    }, __('Apply Rewrite', 'pitchperfect')),
                    createElement(Button, {
                        key: 'rewrite-copy',
                        isSecondary: true,
                        isSmall: true,
                        onClick: () => copyRewrite(rewrite),
                        style: { marginLeft: '6px' },
                    }, __('Copy', 'pitchperfect')),
                ]))),
            ]),
            
            // Summary
            suggestions.length > 0 && createElement(PanelBody, {
                key: 'summary',
                title: __('Summary', 'pitchperfect'),
                initialOpen: true,
            }, [
                createElement('div', {
                    key: 'stats',
                    style: {
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '8px',
                        marginBottom: '12px',
                    },
                }, [
                    createElement('div', {
                        key: 'errors',
                        style: { textAlign: 'center', padding: '8px', backgroundColor: '#fef7f1', borderRadius: '4px' },
                    }, [
                        createElement('div', { key: 'count', style: { fontSize: '20px', fontWeight: 'bold', color: SEVERITY_COLORS.error } },
                            suggestions.filter(s => s.severity === 'error' && !dismissedIds.has(s.id)).length
                        ),
                        createElement('div', { key: 'label', style: { fontSize: '10px', color: '#757575' } }, 'Errors'),
                    ]),
                    createElement('div', {
                        key: 'warnings',
                        style: { textAlign: 'center', padding: '8px', backgroundColor: '#fef8e7', borderRadius: '4px' },
                    }, [
                        createElement('div', { key: 'count', style: { fontSize: '20px', fontWeight: 'bold', color: SEVERITY_COLORS.warning } },
                            suggestions.filter(s => s.severity === 'warning' && !dismissedIds.has(s.id)).length
                        ),
                        createElement('div', { key: 'label', style: { fontSize: '10px', color: '#757575' } }, 'Warnings'),
                    ]),
                    createElement('div', {
                        key: 'info',
                        style: { textAlign: 'center', padding: '8px', backgroundColor: '#e5f5fa', borderRadius: '4px' },
                    }, [
                        createElement('div', { key: 'count', style: { fontSize: '20px', fontWeight: 'bold', color: SEVERITY_COLORS.info } },
                            suggestions.filter(s => s.severity === 'info' && !dismissedIds.has(s.id)).length
                        ),
                        createElement('div', { key: 'label', style: { fontSize: '10px', color: '#757575' } }, 'Info'),
                    ]),
                ]),
            ]),
            
            // Filters
            suggestions.length > 0 && createElement(PanelBody, {
                key: 'filters',
                title: __('Filters', 'pitchperfect'),
                initialOpen: false,
            }, [
                createElement(SelectControl, {
                    key: 'type-filter',
                    label: __('Type', 'pitchperfect'),
                    value: filterType,
                    options: [
                        { label: 'All Types', value: 'all' },
                        ...Object.entries(TYPE_LABELS).map(([value, label]) => ({
                            label: `${label} (${suggestionCounts[value] || 0})`,
                            value,
                        })),
                    ],
                    onChange: setFilterType,
                }),
                createElement(SelectControl, {
                    key: 'severity-filter',
                    label: __('Severity', 'pitchperfect'),
                    value: filterSeverity,
                    options: [
                        { label: 'All Severities', value: 'all' },
                        { label: 'Errors', value: 'error' },
                        { label: 'Warnings', value: 'warning' },
                        { label: 'Info', value: 'info' },
                    ],
                    onChange: setFilterSeverity,
                }),
            ]),
            
            // Suggestions List
            createElement(PanelBody, {
                key: 'suggestions',
                title: `${__('Suggestions', 'pitchperfect')} (${filteredSuggestions.length})`,
                initialOpen: true,
            }, [
                filteredSuggestions.length === 0 && suggestions.length === 0 && createElement('p', {
                    key: 'empty',
                    style: { color: '#757575', fontStyle: 'italic' },
                }, __('Click "Analyse Content" to check your article.', 'pitchperfect')),
                
                filteredSuggestions.length === 0 && suggestions.length > 0 && createElement('p', {
                    key: 'filtered-empty',
                    style: { color: '#757575', fontStyle: 'italic' },
                }, __('No suggestions match your filters.', 'pitchperfect')),
                
                ...filteredSuggestions.map(renderSuggestion),
            ]),
            
            // About
            createElement(PanelBody, {
                key: 'about',
                title: __('About PitchPerfect', 'pitchperfect'),
                initialOpen: false,
            }, [
                createElement('p', {
                    key: 'desc',
                    style: { fontSize: '12px', color: '#757575' },
                }, __('PitchPerfect helps football journalists write better articles with UK English conventions and football-specific style guidance.', 'pitchperfect')),
                createElement('p', {
                    key: 'version',
                    style: { fontSize: '11px', color: '#999' },
                }, 'Version ' + (window.pitchPerfectData?.version || '1.0.0')),
            ]),
        ]),
    ]);
};

// Register the plugin
registerPlugin('pitchperfect', {
    render: PitchPerfectSidebar,
    icon: 'editor-spellcheck',
});
