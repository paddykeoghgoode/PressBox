/**
 * PitchPerfect - Football Writing Assistant
 * Main editor entry point
 */

const { registerPlugin } = wp.plugins;
const { PluginSidebar, PluginSidebarMoreMenuItem } = wp.editPost;
const { PanelBody, Button, Spinner, SelectControl, ToggleControl, Notice } = wp.components;
const { useSelect, useDispatch, dispatch, select } = wp.data;
const { useState, useEffect, useCallback, Fragment, createElement } = wp.element;
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

    // Get post content and metadata
    const { postContent, postId, postTitle } = useSelect((select) => {
        const editor = select('core/editor');
        return {
            postContent: editor.getEditedPostContent(),
            postId: editor.getCurrentPostId(),
            postTitle: editor.getEditedPostAttribute('title'),
        };
    }, []);

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
        // For now, just dismiss the suggestion
        // Full implementation would need block-level editing
        dismissSuggestion(suggestion.id);
        
        // Show notice
        dispatch('core/notices').createNotice(
            'info',
            __('Suggestion applied. Review the change in your content.', 'pitchperfect'),
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
