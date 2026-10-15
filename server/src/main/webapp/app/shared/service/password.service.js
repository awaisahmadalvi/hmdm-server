angular.module('headwind-kiosk')
    .factory('passwordService', function (localization) {

        // Character classes behind the "password strength" setting (Settings ->
        // General settings -> Security): 1 = digits + lower + upper case,
        // 2 = the same + a special character. Shared by checkQuality (the
        // actual check) and ruleChecks (the live checklist on Profile), so the
        // two can never disagree.
        var PATTERNS = {
            digit: /\d/,
            lower: /[a-z]/,
            upper: /[A-Z]/,
            special: /[_\-.,!#$%()=+;*\/]/
        };

        return {
            checkQuality: function(password, length, strength) {
                if (password.length < length) {
                    return false;
                }

                if (strength === 0) {
                    return true;
                }

                var hasDigits = PATTERNS.digit.test(password);
                var hasLower = PATTERNS.lower.test(password);
                var hasCaps = PATTERNS.upper.test(password);


                if (strength === 1) {
                    return hasDigits && hasLower && hasCaps;
                }

                if (strength === 2) {
                    var hasSpecial = PATTERNS.special.test(password);
                    return hasDigits && hasLower && hasCaps && hasSpecial;
                }
                // Reserved
                return false;

            },
            qualityMessage: function(length, strength) {
                var message = '';
                if (length > 0) {
                    message += localization.localize('form.password.length').replace('${length}', length);
                }
                if (strength == 1) {
                    message += localization.localize('form.settings.misc.password.alphanumeric');
                } else if (strength == 2) {
                    message += localization.localize('form.settings.misc.password.specialchar');
                }
                return message;
            },
            // The configured rules as a checklist ({key, label, met}) for the
            // given password - display only, checkQuality stays the check.
            // Empty when no rules are configured.
            ruleChecks: function (password, length, strength) {
                password = password || '';
                var rules = [];
                if (length > 0) {
                    rules.push({key: 'length', met: password.length >= length,
                        label: localization.localize('form.profile.rule.length').replace('${length}', length)});
                }
                if (strength === 1 || strength === 2) {
                    ['lower', 'upper', 'digit'].forEach(function (key) {
                        rules.push({key: key, met: PATTERNS[key].test(password),
                            label: localization.localize('form.profile.rule.' + key)});
                    });
                }
                if (strength === 2) {
                    rules.push({key: 'special', met: PATTERNS.special.test(password),
                        label: localization.localize('form.profile.rule.special')});
                }
                return rules;
            },
            // A simple 0-4 strength score for a meter (length + variety of
            // character classes) - display only
            strength: function (password) {
                password = password || '';
                if (!password) {
                    return 0;
                }
                var score = 0;
                if (password.length >= 8) {
                    score++;
                }
                if (password.length >= 12) {
                    score++;
                }
                if (PATTERNS.lower.test(password) && PATTERNS.upper.test(password)) {
                    score++;
                }
                if (PATTERNS.digit.test(password)) {
                    score++;
                }
                if (PATTERNS.special.test(password)) {
                    score++;
                }
                if (password.length < 6) {
                    score = Math.min(score, 1);
                }
                return Math.min(score, 4);
            }

        }
    });
