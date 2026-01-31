<?php
/**
 * Plugin Name: PitchPerfect
 * Plugin URI: https://attackingfootball.com
 * Description: Football writing assistant for WordPress - UK English grammar, style, and editorial quality checks for football journalism.
 * Version: 1.0.0
 * Author: Attacking Football
 * Author URI: https://attackingfootball.com
 * License: MIT
 * Text Domain: pitchperfect
 * Domain Path: /languages
 */

if (!defined('ABSPATH')) {
    exit;
}

define('PITCHPERFECT_VERSION', '1.0.0');
define('PITCHPERFECT_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('PITCHPERFECT_PLUGIN_URL', plugin_dir_url(__FILE__));

/**
 * Main PitchPerfect Class
 */
class PitchPerfect {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('init', [$this, 'init']);
        add_action('admin_init', [$this, 'register_settings']);
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_bar_menu', [$this, 'add_admin_bar_menu'], 100);
        add_action('enqueue_block_editor_assets', [$this, 'enqueue_editor_assets']);
        add_action('rest_api_init', [$this, 'register_rest_routes']);
        register_activation_hook(__FILE__, [$this, 'activate']);
    }
    
    public function init() {
        load_plugin_textdomain('pitchperfect', false, dirname(plugin_basename(__FILE__)) . '/languages');
    }
    
    public function activate() {
        $default_options = [
            'enabled_roles' => ['administrator', 'editor'],
            'features' => [
                'grammar_spelling' => true,
                'style_clarity' => true,
                'headlines' => true,
                'football_terminology' => true,
                'match_report' => true,
                'name_consistency' => true,
                'repetition' => true,
                'speculation' => true,
                'score_consistency' => true,
                'rewrite_tools' => true,
                'seo_checks' => true,
                'readability_tone' => true,
            ],
            'preferred_club_names' => [],
            'language' => 'en-GB',
        ];
        
        if (!get_option('pitchperfect_options')) {
            update_option('pitchperfect_options', $default_options);
        }
    }
    
    public function register_settings() {
        register_setting('pitchperfect_options', 'pitchperfect_options', [
            'type' => 'array',
            'sanitize_callback' => [$this, 'sanitize_options'],
        ]);
    }
    
    public function sanitize_options($options) {
        $sanitized = [];
        
        if (isset($options['enabled_roles'])) {
            $sanitized['enabled_roles'] = array_map('sanitize_text_field', (array)$options['enabled_roles']);
        }
        
        if (isset($options['features'])) {
            $sanitized['features'] = array_map(function($val) {
                return (bool)$val;
            }, (array)$options['features']);
        }
        
        if (isset($options['preferred_club_names'])) {
            $sanitized['preferred_club_names'] = array_map('sanitize_text_field', (array)$options['preferred_club_names']);
        }
        
        $sanitized['language'] = 'en-GB';
        
        return $sanitized;
    }
    
    public function add_admin_menu() {
        add_options_page(
            __('PitchPerfect Settings', 'pitchperfect'),
            __('PitchPerfect', 'pitchperfect'),
            'manage_options',
            'pitchperfect',
            [$this, 'render_settings_page']
        );
    }

    public function add_admin_bar_menu($wp_admin_bar) {
        if (!current_user_can('manage_options') || !is_admin_bar_showing()) {
            return;
        }

        $wp_admin_bar->add_node([
            'id' => 'pitchperfect',
            'title' => __('PitchPerfect', 'pitchperfect'),
            'href' => admin_url('options-general.php?page=pitchperfect'),
            'meta' => [
                'class' => 'pitchperfect-admin-bar',
            ],
        ]);
    }
    
    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        
        $options = get_option('pitchperfect_options', []);
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            
            <form action="options.php" method="post">
                <?php settings_fields('pitchperfect_options'); ?>
                
                <h2><?php _e('Role Access', 'pitchperfect'); ?></h2>
                <table class="form-table">
                    <tr>
                        <th scope="row"><?php _e('Enable for Roles', 'pitchperfect'); ?></th>
                        <td>
                            <?php
                            $roles = wp_roles()->roles;
                            $enabled_roles = $options['enabled_roles'] ?? ['administrator', 'editor'];
                            foreach ($roles as $role_key => $role) :
                            ?>
                                <label style="display: block; margin-bottom: 5px;">
                                    <input type="checkbox" 
                                           name="pitchperfect_options[enabled_roles][]" 
                                           value="<?php echo esc_attr($role_key); ?>"
                                           <?php checked(in_array($role_key, $enabled_roles)); ?>>
                                    <?php echo esc_html($role['name']); ?>
                                </label>
                            <?php endforeach; ?>
                        </td>
                    </tr>
                </table>
                
                <h2><?php _e('Feature Toggles', 'pitchperfect'); ?></h2>
                <table class="form-table">
                    <?php
                    $features = [
                        'grammar_spelling' => __('Grammar & Spelling (UK English)', 'pitchperfect'),
                        'style_clarity' => __('Style & Clarity', 'pitchperfect'),
                        'headlines' => __('Headline Checks', 'pitchperfect'),
                        'football_terminology' => __('Football Terminology', 'pitchperfect'),
                        'match_report' => __('Match Report Tense Consistency', 'pitchperfect'),
                        'name_consistency' => __('Club & Player Name Consistency', 'pitchperfect'),
                        'repetition' => __('Repetition Detection', 'pitchperfect'),
                        'speculation' => __('Speculation Warnings', 'pitchperfect'),
                        'score_consistency' => __('Score Consistency', 'pitchperfect'),
                        'rewrite_tools' => __('Rewrite Tools (Shorten, Simplify, Punchy, Formal)', 'pitchperfect'),
                        'seo_checks' => __('SEO Checks (Rank Math friendly)', 'pitchperfect'),
                        'readability_tone' => __('Readability & Tone', 'pitchperfect'),
                    ];
                    
                    $enabled_features = $options['features'] ?? [];
                    
                    foreach ($features as $key => $label) :
                    ?>
                        <tr>
                            <th scope="row"><?php echo esc_html($label); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" 
                                           name="pitchperfect_options[features][<?php echo esc_attr($key); ?>]" 
                                           value="1"
                                           <?php checked(!empty($enabled_features[$key])); ?>>
                                    <?php _e('Enabled', 'pitchperfect'); ?>
                                </label>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </table>
                
                <h2><?php _e('Club Name Preferences', 'pitchperfect'); ?></h2>
                <p class="description"><?php _e('Enter preferred club name formats (one per line, format: Full Name|Preferred Name)', 'pitchperfect'); ?></p>
                <textarea name="pitchperfect_options[preferred_club_names]" 
                          rows="10" 
                          cols="50" 
                          class="large-text code"
                          placeholder="Manchester United|Man Utd&#10;Liverpool FC|Liverpool&#10;Tottenham Hotspur|Spurs"><?php 
                    echo esc_textarea(implode("\n", $options['preferred_club_names'] ?? [])); 
                ?></textarea>
                
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }
    
    public function user_has_access() {
        $options = get_option('pitchperfect_options', []);
        $enabled_roles = $options['enabled_roles'] ?? ['administrator', 'editor'];
        $user = wp_get_current_user();
        
        return array_intersect($enabled_roles, $user->roles) ? true : false;
    }
    
    public function enqueue_editor_assets() {
        if (!$this->user_has_access()) {
            return;
        }
        
        $options = get_option('pitchperfect_options', []);
        
        wp_enqueue_script(
            'pitchperfect-editor',
            PITCHPERFECT_PLUGIN_URL . 'build/index.js',
            ['wp-plugins', 'wp-edit-post', 'wp-element', 'wp-components', 'wp-data', 'wp-editor', 'wp-blocks', 'wp-i18n', 'wp-api-fetch'],
            PITCHPERFECT_VERSION,
            true
        );
        
        wp_localize_script('pitchperfect-editor', 'pitchPerfectData', [
            'nonce' => wp_create_nonce('wp_rest'),
            'restUrl' => rest_url('pitchperfect/v1/'),
            'options' => $options,
            'isAdmin' => current_user_can('manage_options'),
        ]);
        
        wp_enqueue_style(
            'pitchperfect-editor',
            PITCHPERFECT_PLUGIN_URL . 'build/style.css',
            [],
            PITCHPERFECT_VERSION
        );
    }
    
    public function register_rest_routes() {
        register_rest_route('pitchperfect/v1', '/analyse', [
            'methods' => 'POST',
            'callback' => [$this, 'analyse_content'],
            'permission_callback' => [$this, 'check_permission'],
        ]);

        register_rest_route('pitchperfect/v1', '/rewrite', [
            'methods' => 'POST',
            'callback' => [$this, 'rewrite_content'],
            'permission_callback' => [$this, 'check_permission'],
        ]);
    }
    
    public function check_permission() {
        return $this->user_has_access();
    }
    
    public function analyse_content(WP_REST_Request $request) {
        $content = $request->get_param('content');
        $post_id = $request->get_param('postId');
        
        if (empty($content)) {
            return new WP_REST_Response(['suggestions' => []], 200);
        }
        
        $options = get_option('pitchperfect_options', []);
        $enabled_features = $options['features'] ?? [];
        
        $analyzer = new PitchPerfect_Analyzer($enabled_features, $options, $post_id);
        $suggestions = $analyzer->analyse($content);
        
        return new WP_REST_Response(['suggestions' => $suggestions], 200);
    }

    public function rewrite_content(WP_REST_Request $request) {
        $content = $request->get_param('content');
        $mode = $request->get_param('mode');

        if (empty($content)) {
            return new WP_REST_Response(['rewrites' => []], 200);
        }

        $options = get_option('pitchperfect_options', []);
        $enabled_features = $options['features'] ?? [];

        if (empty($enabled_features['rewrite_tools'])) {
            return new WP_REST_Response(['rewrites' => []], 200);
        }

        $analyzer = new PitchPerfect_Analyzer($enabled_features, $options);
        $rewrites = $analyzer->rewrite($content, $mode);

        return new WP_REST_Response(['rewrites' => $rewrites], 200);
    }
}

/**
 * Content Analyzer Class
 */
class PitchPerfect_Analyzer {
    
    private $features;
    private $options;
    private $post_id;
    private $suggestions = [];
    private $suggestion_id = 0;
    
    // UK spelling replacements
    private $uk_spellings = [
        'color' => 'colour',
        'colors' => 'colours',
        'colored' => 'coloured',
        'favor' => 'favour',
        'favors' => 'favours',
        'favored' => 'favoured',
        'favorite' => 'favourite',
        'favorites' => 'favourites',
        'honor' => 'honour',
        'honors' => 'honours',
        'honored' => 'honoured',
        'labor' => 'labour',
        'labors' => 'labours',
        'labored' => 'laboured',
        'neighbor' => 'neighbour',
        'neighbors' => 'neighbours',
        'defense' => 'defence',
        'offense' => 'offence',
        'defensive' => 'defensive',
        'center' => 'centre',
        'centers' => 'centres',
        'centered' => 'centred',
        'theater' => 'theatre',
        'theaters' => 'theatres',
        'meter' => 'metre',
        'meters' => 'metres',
        'liter' => 'litre',
        'liters' => 'litres',
        'fiber' => 'fibre',
        'fibers' => 'fibres',
        'analyze' => 'analyse',
        'analyzed' => 'analysed',
        'analyzing' => 'analysing',
        'organize' => 'organise',
        'organized' => 'organised',
        'organizing' => 'organising',
        'recognize' => 'recognise',
        'recognized' => 'recognised',
        'recognizing' => 'recognising',
        'realize' => 'realise',
        'realized' => 'realised',
        'realizing' => 'realising',
        'capitalize' => 'capitalise',
        'capitalized' => 'capitalised',
        'capitalizing' => 'capitalising',
        'apologize' => 'apologise',
        'apologized' => 'apologised',
        'apologizing' => 'apologising',
        'criticize' => 'criticise',
        'criticized' => 'criticised',
        'criticizing' => 'criticising',
        'minimize' => 'minimise',
        'minimized' => 'minimised',
        'minimizing' => 'minimising',
        'maximize' => 'maximise',
        'maximized' => 'maximised',
        'maximizing' => 'maximising',
        'finalize' => 'finalise',
        'finalized' => 'finalised',
        'finalizing' => 'finalising',
        'utilize' => 'utilise',
        'utilized' => 'utilised',
        'utilizing' => 'utilising',
        'program' => 'programme',
        'programs' => 'programmes',
        'traveling' => 'travelling',
        'traveled' => 'travelled',
        'traveler' => 'traveller',
        'travelers' => 'travellers',
        'canceled' => 'cancelled',
        'canceling' => 'cancelling',
        'labeled' => 'labelled',
        'labeling' => 'labelling',
        'modeled' => 'modelled',
        'modeling' => 'modelling',
        'signaled' => 'signalled',
        'signaling' => 'signalling',
        'fueled' => 'fuelled',
        'fueling' => 'fuelling',
        'jewelry' => 'jewellery',
        'gray' => 'grey',
        'grays' => 'greys',
        'plow' => 'plough',
        'plows' => 'ploughs',
        'plowed' => 'ploughed',
        'plowing' => 'ploughing',
        'mold' => 'mould',
        'molds' => 'moulds',
        'molded' => 'moulded',
        'molding' => 'moulding',
        'skeptic' => 'sceptic',
        'skeptics' => 'sceptics',
        'skeptical' => 'sceptical',
        'skepticism' => 'scepticism',
    ];
    
    // Non-UK football terminology
    private $football_terminology = [
        'soccer' => ['football', 'Football is the standard term in UK journalism.'],
        'field' => ['pitch', 'Use "pitch" for the playing surface in UK football journalism.'],
        'playoffs' => ['play-offs', 'Use "play-offs" (hyphenated) in UK English.'],
        'cleats' => ['boots', 'Use "boots" for football footwear in UK journalism.'],
        'roster' => ['squad', 'Use "squad" for the team list in UK football journalism.'],
        'offsides' => ['offside', '"Offside" is singular in UK football terminology.'],
        'shutout' => ['clean sheet', 'Use "clean sheet" for a match without conceding.'],
        'overtime' => ['extra time', 'Use "extra time" in UK football journalism.'],
        'shootout' => ['penalty shoot-out', 'Use "penalty shoot-out" in UK football journalism.'],
        'tied' => ['drew', 'Use "drew" for a drawn match in UK English.'],
        'goaltender' => ['goalkeeper', 'Use "goalkeeper" or "keeper" in UK football journalism.'],
        'goalie' => ['goalkeeper', 'Use "goalkeeper" or "keeper" in UK football journalism.'],
    ];
    
    // Weak headline verbs
    private $weak_verbs = ['was', 'were', 'is', 'are', 'had', 'have', 'has', 'been', 'being', 'got', 'get', 'gets'];

    // Strong headline verbs for quick rewrites
    private $strong_headline_verbs = ['stun', 'edge', 'sink', 'smash', 'dominate', 'punish', 'seal', 'snatch', 'outclass', 'thrash'];
    
    // Speculative language
    private $speculation_words = [
        'likely' => 'Consider attributing this claim or softening with "reportedly".',
        'could' => 'Speculative language - consider adding a source or clarifying uncertainty.',
        'might' => 'Speculative language - consider adding a source or clarifying uncertainty.',
        'may' => 'Speculative language in predictions - consider adding a source.',
        'expected to' => 'Attribution suggested for expectations.',
        'set to' => 'Consider verifying or attributing "set to" claims.',
        'understood to' => 'Consider explicit attribution for "understood to" claims.',
        'believed to' => 'Consider explicit attribution for "believed to" claims.',
        'thought to' => 'Consider explicit attribution for "thought to" claims.',
        'reportedly' => 'Ensure a source exists for "reportedly" claims.',
        'rumoured' => 'Transfer rumour detected - ensure appropriate sourcing.',
        'rumored' => 'Transfer rumour detected - ensure appropriate sourcing.',
    ];
    
    // Common football word repetitions to watch
    private $repetition_words = [
        'match', 'game', 'side', 'squad', 'team', 'manager', 'boss', 
        'striker', 'midfielder', 'defender', 'goalkeeper', 'player',
        'goal', 'shot', 'pass', 'cross', 'header', 'tackle',
        'win', 'victory', 'defeat', 'loss', 'draw',
        'season', 'campaign', 'fixture', 'clash', 'encounter',
    ];

    private $repetition_synonyms = [
        'match' => ['fixture', 'clash', 'encounter'],
        'game' => ['fixture', 'clash', 'encounter'],
        'team' => ['side', 'squad'],
        'squad' => ['side', 'team'],
        'goal' => ['strike', 'finish', 'effort'],
        'shot' => ['effort', 'attempt', 'strike'],
        'pass' => ['ball', 'delivery'],
        'cross' => ['delivery', 'ball in'],
        'win' => ['victory', 'triumph'],
        'loss' => ['defeat', 'setback'],
        'draw' => ['stalemate', 'share of the spoils'],
    ];
    
    public function __construct($features, $options, $post_id = 0) {
        $this->features = $features;
        $this->options = $options;
        $this->post_id = (int) $post_id;
    }
    
    public function analyse($content) {
        $this->suggestions = [];
        $this->suggestion_id = 0;
        
        // Strip HTML but preserve positions
        $text = wp_strip_all_tags($content);
        
        if (!empty($this->features['grammar_spelling'])) {
            $this->check_uk_spelling($text);
            $this->check_grammar($text);
        }
        
        if (!empty($this->features['football_terminology'])) {
            $this->check_football_terminology($text);
        }
        
        if (!empty($this->features['style_clarity'])) {
            $this->check_style_clarity($text);
        }
        
        if (!empty($this->features['headlines'])) {
            $this->check_headlines($content);
        }
        
        if (!empty($this->features['match_report'])) {
            $this->check_tense_consistency($text);
        }
        
        if (!empty($this->features['speculation'])) {
            $this->check_speculation($text);
        }
        
        if (!empty($this->features['repetition'])) {
            $this->check_repetition($text);
        }
        
        if (!empty($this->features['score_consistency'])) {
            $this->check_score_consistency($text);
        }
        
        if (!empty($this->features['name_consistency'])) {
            $this->check_name_consistency($text);
        }

        if (!empty($this->features['seo_checks'])) {
            $this->check_seo($content);
        }

        if (!empty($this->features['readability_tone'])) {
            $this->check_readability($text);
            $this->check_tone($text);
        }
        
        return $this->suggestions;
    }

    public function rewrite($content, $mode = 'shorten') {
        $text = wp_strip_all_tags($content);
        $sentences = preg_split('/(?<=[.!?])\s+/', $text, -1, PREG_SPLIT_NO_EMPTY);
        $rewrites = [];
        $rewrite_id = 0;
        $modes = $mode === 'all' ? ['shorten', 'simplify', 'punchy', 'formal'] : [$mode];

        foreach ($sentences as $sentence) {
            $sentence = trim($sentence);
            if ($sentence === '') {
                continue;
            }

            foreach ($modes as $current_mode) {
                $rewritten = $this->rewrite_sentence($sentence, $current_mode);
                if ($rewritten && $rewritten !== $sentence) {
                    $rewrites[] = [
                        'id' => 'rewrite_' . str_pad(++$rewrite_id, 3, '0', STR_PAD_LEFT),
                        'mode' => $current_mode,
                        'original' => $sentence,
                        'rewrite' => $rewritten,
                        'explanation' => $this->rewrite_explanation($current_mode),
                    ];
                }
            }
        }

        return $rewrites;
    }

    private function rewrite_sentence($sentence, $mode) {
        $rewritten = $sentence;

        $filler_words = ['very', 'really', 'quite', 'just', 'actually', 'basically', 'literally', 'somewhat'];
        $simplify_map = [
            'utilise' => 'use',
            'utilize' => 'use',
            'commence' => 'start',
            'terminate' => 'end',
            'assistance' => 'help',
            'endeavour' => 'try',
            'numerous' => 'many',
            'approximately' => 'about',
            'significant' => 'big',
            'demonstrate' => 'show',
            'possess' => 'have',
            'purchase' => 'buy',
            'immediately' => 'right away',
            'commonly' => 'often',
        ];
        $punchy_map = [
            'was' => 'proved',
            'were' => 'proved',
            'is' => 'stays',
            'are' => 'stay',
            'got' => 'grabbed',
            'gets' => 'grabs',
            'made' => 'delivered',
            'make' => 'deliver',
            'had' => 'sealed',
            'have' => 'seal',
            'take' => 'seize',
            'took' => 'seized',
        ];
        $contractions = [
            "can't" => 'cannot',
            "won't" => 'will not',
            "don't" => 'do not',
            "doesn't" => 'does not',
            "didn't" => 'did not',
            "isn't" => 'is not',
            "aren't" => 'are not',
            "wasn't" => 'was not',
            "weren't" => 'were not',
            "haven't" => 'have not',
            "hasn't" => 'has not',
            "hadn't" => 'had not',
            "shouldn't" => 'should not',
            "wouldn't" => 'would not',
            "couldn't" => 'could not',
            "it's" => 'it is',
            "they're" => 'they are',
            "we're" => 'we are',
            "you're" => 'you are',
            "that's" => 'that is',
            "there's" => 'there is',
            "there're" => 'there are',
            "i'm" => 'i am',
        ];

        switch ($mode) {
            case 'simplify':
                foreach ($simplify_map as $from => $to) {
                    $rewritten = preg_replace('/\b' . preg_quote($from, '/') . '\b/i', $to, $rewritten);
                }
                $rewritten = preg_replace('/\b(' . implode('|', $filler_words) . ')\b/i', '', $rewritten);
                $rewritten = preg_replace('/\s{2,}/', ' ', $rewritten);
                break;
            case 'formal':
                foreach ($contractions as $from => $to) {
                    $rewritten = preg_replace('/\b' . preg_quote($from, '/') . '\b/i', $to, $rewritten);
                }
                break;
            case 'punchy':
                foreach ($punchy_map as $from => $to) {
                    $rewritten = preg_replace('/\b' . preg_quote($from, '/') . '\b/i', $to, $rewritten);
                }
                $rewritten = preg_replace('/\b(' . implode('|', $filler_words) . ')\b/i', '', $rewritten);
                $rewritten = preg_replace('/\s{2,}/', ' ', $rewritten);
                break;
            case 'shorten':
            default:
                $rewritten = preg_replace('/\b(' . implode('|', $filler_words) . ')\b/i', '', $rewritten);
                $rewritten = preg_replace('/\s{2,}/', ' ', $rewritten);
                $rewritten = preg_replace('/\s+(which|that)\s+/i', ' ', $rewritten);
                $rewritten = preg_replace('/\s+(and|but)\s+/i', '. ', $rewritten, 1);
                $rewritten = trim($rewritten);
                break;
        }

        $rewritten = trim($rewritten);

        return $rewritten;
    }

    private function rewrite_explanation($mode) {
        $messages = [
            'shorten' => 'Shorten mode removes filler words and splits long sentences for faster reading.',
            'simplify' => 'Simplify mode swaps complex terms for clearer alternatives.',
            'punchy' => 'Punchy mode uses stronger verbs and tighter phrasing.',
            'formal' => 'Formal mode expands contractions for a more editorial tone.',
        ];

        return $messages[$mode] ?? $messages['shorten'];
    }
    
    private function add_suggestion($type, $severity, $start, $end, $message, $replacements = [], $explanation = '', $original = '', $confidence = 0.75) {
        $this->suggestions[] = [
            'id' => 'sug_' . str_pad(++$this->suggestion_id, 3, '0', STR_PAD_LEFT),
            'type' => $type,
            'severity' => $severity,
            'start' => $start,
            'end' => $end,
            'message' => $message,
            'replacements' => $replacements,
            'explanation' => $explanation,
            'original' => $original,
            'confidence' => $confidence,
        ];
    }
    
    private function check_uk_spelling($text) {
        foreach ($this->uk_spellings as $us => $uk) {
            $pattern = '/\b' . preg_quote($us, '/') . '\b/i';
            if (preg_match_all($pattern, $text, $matches, PREG_OFFSET_CAPTURE)) {
                foreach ($matches[0] as $match) {
                    $found = $match[0];
                    $pos = $match[1];
                    
                    // Preserve case
                    $replacement = $uk;
                    if (ctype_upper($found[0])) {
                        $replacement = ucfirst($uk);
                    }
                    if (ctype_upper($found)) {
                        $replacement = strtoupper($uk);
                    }
                    
                    $this->add_suggestion(
                        'spelling',
                        'warning',
                        $pos,
                        $pos + strlen($found),
                        "Use UK spelling: \"$replacement\" instead of \"$found\"",
                        [$replacement],
                        'UK English spelling is standard for football journalism.',
                        $found,
                        0.95
                    );
                }
            }
        }
    }
    
    private function check_grammar($text) {
        // Check "a" vs "an" before vowel sounds
        $pattern = '/\ba\s+([aeiouAEIOU]\w*)\b/';
        if (preg_match_all($pattern, $text, $matches, PREG_OFFSET_CAPTURE)) {
            foreach ($matches[0] as $index => $match) {
                $pos = $match[1];
                $word = $matches[1][$index][0];
                
                // Skip words that sound like consonants (e.g., "a united", "a European")
                $consonant_sounds = ['uni', 'euro', 'one', 'once'];
                $skip = false;
                foreach ($consonant_sounds as $sound) {
                    if (stripos($word, $sound) === 0) {
                        $skip = true;
                        break;
                    }
                }
                
                if (!$skip) {
                    $this->add_suggestion(
                        'grammar',
                        'error',
                        $pos,
                        $pos + strlen($match[0]),
                        "Use \"an\" before words starting with a vowel sound",
                        ["an $word"],
                        'Articles should match the sound of the following word.',
                        $match[0],
                        0.9
                    );
                }
            }
        }
        
        // Check double spaces
        if (preg_match_all('/  +/', $text, $matches, PREG_OFFSET_CAPTURE)) {
            foreach ($matches[0] as $match) {
                $this->add_suggestion(
                    'grammar',
                    'info',
                    $match[1],
                    $match[1] + strlen($match[0]),
                    'Multiple spaces detected',
                    [' '],
                    'Use single spaces between words.',
                    $match[0],
                    0.95
                );
            }
        }
        
        // Check common apostrophe errors
        $apostrophe_errors = [
            "it's" => ['its', 'possessive', "Use \"its\" for possession, \"it's\" for \"it is\""],
            "who's" => ['whose', 'possessive', "Use \"whose\" for possession, \"who's\" for \"who is\""],
            "your" => ["you're", 'contraction', "Use \"you're\" for \"you are\""],
            "there" => ["they're", 'contraction', "Check if \"they're\" (they are) is intended"],
            "their" => ["they're", 'contraction', "Check if \"they're\" (they are) is intended"],
        ];
    }
    
    private function check_football_terminology($text) {
        foreach ($this->football_terminology as $term => $replacement) {
            $pattern = '/\b' . preg_quote($term, '/') . '\b/i';
            if (preg_match_all($pattern, $text, $matches, PREG_OFFSET_CAPTURE)) {
                foreach ($matches[0] as $match) {
                    $found = $match[0];
                    $pos = $match[1];
                    
                    // Preserve case
                    $new_term = $replacement[0];
                    if (ctype_upper($found[0])) {
                        $new_term = ucfirst($replacement[0]);
                    }
                    
                    $this->add_suggestion(
                        'terminology',
                        'warning',
                        $pos,
                        $pos + strlen($found),
                        "Use UK football terminology: \"$new_term\"",
                        [$new_term],
                        $replacement[1],
                        $found,
                        0.9
                    );
                }
            }
        }
        
        // Check "tie" in context of draw (not knockout tie)
        $pattern = '/\b(ended?\s+in\s+a\s+|was\s+a\s+|finished\s+)tie\b/i';
        if (preg_match_all($pattern, $text, $matches, PREG_OFFSET_CAPTURE)) {
            foreach ($matches[0] as $match) {
                $this->add_suggestion(
                    'terminology',
                    'warning',
                    $match[1],
                    $match[1] + strlen($match[0]),
                    'Consider using "draw" instead of "tie" for a drawn match',
                    [str_ireplace('tie', 'draw', $match[0])],
                    'In UK football, "tie" typically refers to a knockout match, while "draw" refers to an equal result.',
                    $match[0],
                    0.8
                );
            }
        }
    }
    
    private function check_style_clarity($text) {
        // Check sentence length
        $sentences = preg_split('/[.!?]+/', $text);
        $pos = 0;
        
        foreach ($sentences as $sentence) {
            $sentence = trim($sentence);
            if (empty($sentence)) {
                $pos += 1;
                continue;
            }
            
            $word_count = str_word_count($sentence);
            
            if ($word_count > 40) {
                $sentence_pos = strpos($text, $sentence, $pos);
                if ($sentence_pos !== false) {
                    $this->add_suggestion(
                        'clarity',
                        'warning',
                        $sentence_pos,
                        $sentence_pos + strlen($sentence),
                        "This sentence has $word_count words and may be too long",
                        [],
                        'Consider breaking into shorter sentences for better readability in match reports.'
                    );
                }
            }
            
            $pos += strlen($sentence) + 1;
        }
        
        // Check passive voice patterns
        $passive_patterns = [
            '/\b(was|were|been|being|is|are)\s+(being\s+)?\w+ed\b/i',
        ];
        
        foreach ($passive_patterns as $pattern) {
            if (preg_match_all($pattern, $text, $matches, PREG_OFFSET_CAPTURE)) {
                foreach ($matches[0] as $match) {
                    // Skip common acceptable passives
                    $acceptable = ['was signed', 'was injured', 'was substituted', 'was suspended', 'was named', 'were drawn'];
                    $skip = false;
                    foreach ($acceptable as $ok) {
                        if (stripos($match[0], $ok) !== false) {
                            $skip = true;
                            break;
                        }
                    }
                    
                    if (!$skip) {
                        $this->add_suggestion(
                            'style',
                            'info',
                            $match[1],
                            $match[1] + strlen($match[0]),
                            'Possible passive voice - consider active voice for more dynamic prose',
                            [],
                            'Active voice often creates more engaging match reports. E.g., "Salah scored" vs "The goal was scored by Salah".'
                        );
                    }
                }
            }
        }

        if (preg_match_all('/\b\w+ly\b/i', $text, $matches, PREG_OFFSET_CAPTURE)) {
            if (count($matches[0]) >= 10) {
                $this->add_suggestion(
                    'style',
                    'info',
                    $matches[0][0][1],
                    $matches[0][0][1] + strlen($matches[0][0][0]),
                    'Heavy adverb use detected',
                    [],
                    'Too many adverbs can weaken clarity. Consider stronger verbs instead.'
                );
            }
        }

        $wordy_phrases = [
            'in order to' => 'to',
            'at this point in time' => 'now',
            'due to the fact that' => 'because',
            'has the ability to' => 'can',
            'in the event that' => 'if',
            'with regard to' => 'regarding',
            'in the near future' => 'soon',
            'in light of the fact that' => 'because',
        ];

        foreach ($wordy_phrases as $phrase => $replacement) {
            $pattern = '/\b' . preg_quote($phrase, '/') . '\b/i';
            if (preg_match_all($pattern, $text, $matches, PREG_OFFSET_CAPTURE)) {
                foreach ($matches[0] as $match) {
                    $this->add_suggestion(
                        'clarity',
                        'info',
                        $match[1],
                        $match[1] + strlen($match[0]),
                        "Wordy phrase detected: \"{$match[0]}\"",
                        [$replacement],
                        'Tightening phrases improves pace and readability.',
                        $match[0],
                        0.85
                    );
                }
            }
        }
    }
    
    private function check_headlines($content) {
        // Extract headings from content (looking for h1-h6 tags or ## markdown)
        $heading_pattern = '/<h[1-6][^>]*>(.*?)<\/h[1-6]>/is';
        
        if (preg_match_all($heading_pattern, $content, $matches, PREG_OFFSET_CAPTURE)) {
            foreach ($matches[1] as $match) {
                $heading = wp_strip_all_tags($match[0]);
                $pos = $match[1];
                
                // Check length
                $char_count = strlen($heading);
                if ($char_count > 70) {
                    $this->add_suggestion(
                        'headline',
                        'warning',
                        $pos,
                        $pos + strlen($heading),
                        "Headline is $char_count characters - consider shortening for better impact",
                        [],
                        'Shorter headlines (under 70 characters) typically perform better.'
                    );
                }
                
                // Check for weak verbs
                foreach ($this->weak_verbs as $verb) {
                    $pattern = '/\b' . preg_quote($verb, '/') . '\b/i';
                    if (preg_match($pattern, $heading)) {
                        $rewrites = [];
                        foreach ($this->strong_headline_verbs as $strong) {
                            $candidate = preg_replace($pattern, $strong, $heading, 1);
                            if ($candidate && $candidate !== $heading) {
                                $rewrites[] = $candidate;
                            }
                            if (count($rewrites) >= 3) {
                                break;
                            }
                        }
                        $this->add_suggestion(
                            'headline',
                            'info',
                            $pos,
                            $pos + strlen($heading),
                            "Headline contains weak verb \"$verb\" - consider stronger alternatives",
                            $rewrites,
                            'Strong, active verbs make headlines more compelling. E.g., "Arsenal were beaten" → "City punish Arsenal".',
                            $heading,
                            0.65
                        );
                        break; // One warning per headline
                    }
                }
                
                // Check for passive voice in headlines
                if (preg_match('/\b(was|were)\s+\w+ed\b/i', $heading)) {
                    $this->add_suggestion(
                        'headline',
                        'warning',
                        $pos,
                        $pos + strlen($heading),
                        'Headline uses passive voice - consider rewriting in active voice',
                        [],
                        'Active headlines are more engaging. E.g., "Manager was sacked" → "Board sack manager".'
                    );
                }
            }
        }
    }
    
    private function check_tense_consistency($text) {
        // Split into paragraphs
        $paragraphs = preg_split('/\n\n+/', $text);
        
        $past_count = 0;
        $present_count = 0;
        
        // Simple tense detection
        $past_indicators = ['scored', 'played', 'won', 'lost', 'drew', 'beat', 'defeated', 'missed', 'saved', 'headed', 'struck', 'shot', 'passed', 'crossed', 'tackled', 'fouled'];
        $present_indicators = ['scores', 'plays', 'wins', 'loses', 'draws', 'beats', 'defeats', 'misses', 'saves', 'heads', 'strikes', 'shoots', 'passes', 'crosses', 'tackles', 'fouls'];
        
        foreach ($paragraphs as $para) {
            $para_past = 0;
            $para_present = 0;
            
            foreach ($past_indicators as $word) {
                $para_past += substr_count(strtolower($para), $word);
            }
            foreach ($present_indicators as $word) {
                $para_present += substr_count(strtolower($para), $word);
            }
            
            $past_count += $para_past;
            $present_count += $para_present;
        }
        
        // Only warn if there's a significant mix
        $total = $past_count + $present_count;
        if ($total > 5) {
            $past_ratio = $past_count / $total;
            $present_ratio = $present_count / $total;
            
            if ($past_ratio > 0.2 && $past_ratio < 0.8) {
                $this->add_suggestion(
                    'consistency',
                    'warning',
                    0,
                    100,
                    'Mixed tenses detected - the article switches between past and present tense',
                    [],
                    'Match reports typically use consistent past tense. Consider reviewing for tense consistency throughout.'
                );
            }
        }
    }
    
    private function check_speculation($text) {
        foreach ($this->speculation_words as $term => $explanation) {
            $pattern = '/\b' . preg_quote($term, '/') . '\b/i';
            if (preg_match_all($pattern, $text, $matches, PREG_OFFSET_CAPTURE)) {
                foreach ($matches[0] as $match) {
                    $this->add_suggestion(
                        'speculation',
                        'info',
                        $match[1],
                        $match[1] + strlen($match[0]),
                        "Speculative language: \"" . $match[0] . "\"",
                        [],
                        $explanation
                    );
                }
            }
        }
    }
    
    private function check_repetition($text) {
        $text_lower = strtolower($text);
        $word_counts = [];
        
        foreach ($this->repetition_words as $word) {
            $count = substr_count($text_lower, $word);
            if ($count >= 3) {
                $word_counts[$word] = $count;
            }
        }
        
        // Sort by count descending
        arsort($word_counts);
        
        // Report top repetitions
        $reported = 0;
        foreach ($word_counts as $word => $count) {
            if ($reported >= 5) break;
            
            // Find first occurrence
            $pos = stripos($text, $word);
            if ($pos !== false) {
                $replacements = $this->repetition_synonyms[$word] ?? [];
                $this->add_suggestion(
                    'repetition',
                    'info',
                    $pos,
                    $pos + strlen($word),
                    "\"$word\" appears $count times in the article",
                    $replacements,
                    'Consider using synonyms to avoid repetition. Alternatives might help maintain reader engagement.',
                    '',
                    0.55
                );
                $reported++;
            }
        }
    }
    
    private function check_score_consistency($text) {
        // Find all scoreline patterns
        $pattern = '/\b(\d{1,2})\s*[-–—]\s*(\d{1,2})\b/';
        
        if (preg_match_all($pattern, $text, $matches, PREG_OFFSET_CAPTURE)) {
            $scores = [];
            
            foreach ($matches[0] as $match) {
                $score = preg_replace('/\s+/', '', $match[0]);
                $score = str_replace(['–', '—'], '-', $score);
                $scores[] = [
                    'score' => $score,
                    'pos' => $match[1],
                    'text' => $match[0],
                ];
            }
            
            // Check for inconsistencies (same match, different scores)
            if (count($scores) > 1) {
                $unique_scores = array_unique(array_column($scores, 'score'));
                
                if (count($unique_scores) > 1) {
                    $this->add_suggestion(
                        'consistency',
                        'error',
                        $scores[0]['pos'],
                        $scores[0]['pos'] + strlen($scores[0]['text']),
                        'Multiple different scorelines detected: ' . implode(', ', $unique_scores),
                        [],
                        'Please verify the correct scoreline. Inconsistent scores confuse readers.'
                    );
                }
            }
        }
    }

    private function check_readability($text) {
        $clean_text = trim(preg_replace('/\s+/', ' ', $text));
        if ($clean_text === '') {
            return;
        }

        $sentences = preg_split('/[.!?]+/', $clean_text, -1, PREG_SPLIT_NO_EMPTY);
        $sentence_count = max(1, count($sentences));
        $word_count = str_word_count($clean_text);
        if ($word_count < 30) {
            return;
        }

        $syllable_count = 0;
        $words = preg_split('/\s+/', $clean_text, -1, PREG_SPLIT_NO_EMPTY);
        foreach ($words as $word) {
            $syllable_count += $this->count_syllables($word);
        }

        $reading_ease = 206.835 - (1.015 * ($word_count / $sentence_count)) - (84.6 * ($syllable_count / max(1, $word_count)));
        $reading_ease = round($reading_ease);

        $level = 'Standard';
        $severity = 'info';
        if ($reading_ease >= 90) {
            $level = 'Very easy';
        } elseif ($reading_ease >= 80) {
            $level = 'Easy';
        } elseif ($reading_ease >= 70) {
            $level = 'Fairly easy';
        } elseif ($reading_ease >= 60) {
            $level = 'Standard';
        } elseif ($reading_ease >= 50) {
            $level = 'Fairly difficult';
            $severity = 'warning';
        } elseif ($reading_ease >= 30) {
            $level = 'Difficult';
            $severity = 'warning';
        } else {
            $level = 'Very difficult';
            $severity = 'warning';
        }

        $this->add_suggestion(
            'readability',
            $severity,
            0,
            min(80, strlen($clean_text)),
            "Readability score: $reading_ease ($level)",
            [],
            'Lower scores can reduce clarity for match reports. Aim for Standard or higher.'
        );
    }

    private function count_syllables($word) {
        $word = strtolower(preg_replace('/[^a-z]/', '', $word));
        if ($word === '') {
            return 0;
        }

        $word = preg_replace('/e$/', '', $word);
        preg_match_all('/[aeiouy]+/', $word, $matches);
        $count = count($matches[0]);

        return max(1, $count);
    }

    private function check_tone($text) {
        $filler_words = [
            'very', 'really', 'quite', 'just', 'actually', 'basically',
            'literally', 'somewhat', 'pretty', 'kind of', 'sort of',
        ];
        $text_lower = strtolower($text);
        $count = 0;

        foreach ($filler_words as $word) {
            $pattern = '/\b' . preg_quote($word, '/') . '\b/';
            if (preg_match_all($pattern, $text_lower, $matches)) {
                $count += count($matches[0]);
            }
        }

        if ($count >= 8) {
            $this->add_suggestion(
                'tone',
                'info',
                0,
                min(80, strlen($text)),
                "Filler words detected ($count instances)",
                [],
                'Reducing filler words creates a sharper, more authoritative tone.'
            );
        }
    }
    
    private function check_name_consistency($text) {
        // Common Premier League club name variations
        $club_variations = [
            'manchester united' => ['man united', 'man utd', 'united', 'the red devils'],
            'manchester city' => ['man city', 'city', 'the citizens'],
            'liverpool' => ['liverpool fc', 'the reds'],
            'chelsea' => ['chelsea fc', 'the blues'],
            'arsenal' => ['arsenal fc', 'the gunners'],
            'tottenham hotspur' => ['tottenham', 'spurs', 'the lilywhites'],
            'west ham united' => ['west ham', 'the hammers'],
            'newcastle united' => ['newcastle', 'the magpies'],
            'aston villa' => ['villa', 'the villans'],
            'everton' => ['everton fc', 'the toffees'],
        ];
        
        $text_lower = strtolower($text);
        $found_variations = [];
        
        foreach ($club_variations as $full_name => $variations) {
            $all_names = array_merge([$full_name], $variations);
            $used_names = [];
            
            foreach ($all_names as $name) {
                if (strpos($text_lower, $name) !== false) {
                    $used_names[] = $name;
                }
            }
            
            if (count($used_names) > 2) {
                $pos = stripos($text, $used_names[0]);
                $this->add_suggestion(
                    'consistency',
                    'info',
                    $pos ?: 0,
                    ($pos ?: 0) + strlen($used_names[0]),
                    'Multiple name variations used for same club: ' . implode(', ', $used_names),
                    [],
                    'Consider using consistent naming throughout the article (typically full name first, then one shortened form).'
                );
            }
        }
    }

    private function check_seo($content) {
        if (empty($this->post_id)) {
            return;
        }

        $title = get_the_title($this->post_id);
        if (!$title) {
            if (preg_match('/<h1[^>]*>(.*?)<\/h1>/is', $content, $matches)) {
                $title = wp_strip_all_tags($matches[1]);
            }
        }

        $excerpt = get_post_field('post_excerpt', $this->post_id);
        if (empty($excerpt)) {
            $excerpt = get_post_meta($this->post_id, 'rank_math_description', true);
        }

        $focus_keyword = get_post_meta($this->post_id, 'rank_math_focus_keyword', true);

        if (!empty($title)) {
            $title_length = strlen(trim($title));
            if ($title_length < 45 || $title_length > 70) {
                $this->add_suggestion(
                    'seo',
                    'warning',
                    0,
                    min(60, strlen($title)),
                    "SEO headline length is $title_length characters",
                    [],
                    'Aim for 45–70 characters so search results display cleanly.'
                );
            }
        }

        if (!empty($excerpt)) {
            $excerpt_length = strlen(trim($excerpt));
            if ($excerpt_length < 120 || $excerpt_length > 160) {
                $this->add_suggestion(
                    'seo',
                    'info',
                    0,
                    min(60, strlen($excerpt)),
                    "Meta description length is $excerpt_length characters",
                    [],
                    'Aim for 120–160 characters to improve click-through rates.'
                );
            }
        } else {
            $this->add_suggestion(
                'seo',
                'info',
                0,
                40,
                'Add a meta description or excerpt for SEO',
                [],
                'Search engines and Google News benefit from a clear summary.'
            );
        }

        if (!empty($focus_keyword)) {
            $clean_keyword = trim($focus_keyword);
            $content_text = strtolower(wp_strip_all_tags($content));
            $title_text = strtolower((string) $title);
            if ($clean_keyword && strpos($title_text, strtolower($clean_keyword)) === false) {
                $this->add_suggestion(
                    'seo',
                    'info',
                    0,
                    min(60, strlen($title)),
                    'Focus keyword not found in the headline',
                    [],
                    'Rank Math focus keywords perform best when included in the headline.'
                );
            }

            if ($clean_keyword && strpos($content_text, strtolower($clean_keyword)) === false) {
                $this->add_suggestion(
                    'seo',
                    'info',
                    0,
                    60,
                    'Focus keyword not found in the opening paragraph',
                    [],
                    'Try to include the focus keyword early to improve SEO relevance.'
                );
            }
        }
    }
}

// Initialize the plugin
PitchPerfect::get_instance();
